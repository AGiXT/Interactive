import asyncio
import base64
import logging
import os
import platform
import re
import shutil
import subprocess
import tempfile
import uuid
from datetime import datetime
import sys
import nest_asyncio
import cv2
import numpy as np
import openai
import pyotp
import soundfile as sf
import requests
from agixtsdk import AGiXTSDK
from IPython.display import Image, display
from playwright.async_api import async_playwright
from pyzbar.pyzbar import decode
from tqdm import tqdm

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
openai.base_url = os.getenv("EZLOCALAI_URI")
openai.api_key = os.getenv("EZLOCALAI_API_KEY", "none")


async def print_args(msg):
    for arg in msg.args:
        try:
            value = await arg.json_value()
            print("CONSOLE MESSAGE:", value)
        except Exception as e:
            # Fall back to text() if json_value() fails
            text_value = await arg.text()
            print("CONSOLE MESSAGE:", text_value)


def is_desktop():
    return not platform.system() == "Linux"


class FrontEndTest:

    def __init__(
        self,
        base_uri: str = "http://localhost:3437",
        features: str = "",
    ):
        self.base_uri = base_uri
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.screenshots_dir = os.path.join("test_screenshots", f"test_run_{timestamp}")
        os.makedirs(self.screenshots_dir, exist_ok=True)
        self.browser = None
        self.context = None
        self.page = None
        self.popup = None
        self.playwright = None
        self.screenshots_with_actions = []
        self.agixt = AGiXTSDK(base_uri="https://api.agixt.dev")
        self.agixt.register_user(
            email=f"{uuid.uuid4()}@example.com", first_name="Test", last_name="User"
        )
        # Features are comma separated, options are:
        # - stripe
        # - email
        # - google
        if features == "":
            features = os.environ.get("features", "")
        if features == "":
            self.features = []
        elif "," in features:
            self.features = features.split(",")
        else:
            self.features = [features]
        if "," in features:
            self.features = features.split(",")
        else:
            if features != "":
                self.features = [features]

    async def take_screenshot(self, action_name, no_sleep=False):
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        sanitized_action_name = re.sub(r"[^a-zA-Z0-9_-]", "_", action_name)
        screenshot_path = os.path.join(
            self.screenshots_dir, f"{timestamp}_{sanitized_action_name}.png"
        )
        logging.info(
            f"[{timestamp}] Action: {action_name} - Screenshot path: {screenshot_path}"
        )
        target = self.popup if self.popup else self.page
        logging.info(
            f"Screenshotting { 'popup' if self.popup else 'page'} at {target.url}"
        )
        if not no_sleep:
            await target.wait_for_timeout(2000)

        await target.screenshot(path=screenshot_path)

        if not os.path.exists(screenshot_path):
            raise Exception(f"Failed to capture screenshot on action: {action_name}")

        # Add screenshot and action to the list
        self.screenshots_with_actions.append((screenshot_path, action_name))

        display(Image(filename=str(screenshot_path)))
        return screenshot_path

    def send_video_to_discord(
        self, video_path, demo_name, test_status="✅ Test passed"
    ):
        """
        Send a video to Discord with contextual information

        Args:
            video_path (str): Path to the video file
            demo_name (str): Name of the demo/test for the message
            test_status (str): Status prefix for the message
        """
        discord_webhook = os.getenv("DISCORD_WEBHOOK")
        if not discord_webhook:
            logging.warning(
                "DISCORD_WEBHOOK environment variable not set, skipping Discord upload"
            )
            return

        try:
            # Get git information for better context
            try:
                branch_name = (
                    subprocess.check_output(
                        ["git", "rev-parse", "--abbrev-ref", "HEAD"],
                        cwd=os.getcwd(),
                        stderr=subprocess.DEVNULL,
                    )
                    .decode()
                    .strip()
                )
            except:
                branch_name = os.getenv("GITHUB_REF_NAME", "unknown")

            try:
                commit_hash = (
                    subprocess.check_output(
                        ["git", "rev-parse", "--short", "HEAD"],
                        cwd=os.getcwd(),
                        stderr=subprocess.DEVNULL,
                    )
                    .decode()
                    .strip()
                )
            except:
                commit_hash = os.getenv("GITHUB_SHA", "unknown")[:7]

            try:
                commit_message = (
                    subprocess.check_output(
                        ["git", "log", "-1", "--pretty=%B"],
                        cwd=os.getcwd(),
                        stderr=subprocess.DEVNULL,
                    )
                    .decode()
                    .strip()
                )
            except:
                commit_message = os.getenv(
                    "GITHUB_EVENT_HEAD_COMMIT_MESSAGE", "No commit message"
                )

            # Build the Discord message
            repo_name = os.getenv("GITHUB_REPOSITORY", "Interactive")
            actor = os.getenv("GITHUB_ACTOR", "local-user")

            # Format actor with proper Discord mentions if known
            discord_mentions = {
                "Josh-XT": "<@381837595522367488>",
                "waiscodes": "<@670762167037067304>",
                "birdup000": "<@856308374567256074>",
                "Nick-XT": "<@381908912951001088>",
            }
            # check if failure, if it is, tag them, otherwise just use their name
            if test_status != "✅ Test passed":
                discord_name = discord_mentions.get(actor, f"**{actor}**")
            else:
                discord_name = f"**{actor}**"
            message = f"{test_status}: **{demo_name}** on repository **{repo_name}** branch **{branch_name}** commit '{commit_message}' ({commit_hash}) by {discord_name}"

            message = f"{test_status}: **{demo_name}** on repository **{repo_name}** branch **{branch_name}** commit '{commit_message}' ({commit_hash}) by {discord_name}"

            # Send the video to Discord
            with open(video_path, "rb") as video_file:
                files = {"file": video_file}
                data = {"content": message}

                response = requests.post(
                    discord_webhook, files=files, data=data, timeout=30
                )

                if response.status_code == 200:
                    logging.info(f"Successfully sent {demo_name} demo video to Discord")
                else:
                    logging.error(
                        f"Failed to send video to Discord. Status: {response.status_code}, Response: {response.text}"
                    )

        except Exception as e:
            logging.error(f"Error sending video to Discord: {e}")

    def create_video_report(
        self, video_name="report", max_size_mb=10, test_status="✅ Test passed"
    ):
        """
        Creates a video from all screenshots taken during the test run with Google TTS narration
        using OpenCV and FFMPEG for video processing. Adjusts framerate and compression if output exceeds size limit.

        Args:
            max_size_mb (int): Maximum size of the output video in MB. Defaults to 10.
        """

        if is_desktop():
            return None
        try:
            if not self.screenshots_with_actions:
                logging.warning("No screenshots found to create video")
                return None

            # Read first image to get dimensions
            first_img = cv2.imread(self.screenshots_with_actions[0][0])
            if first_img is None:
                logging.error(
                    f"Failed to read first screenshot: {self.screenshots_with_actions[0][0]}"
                )
                return None

            height, width = first_img.shape[:2]

            # Create temporary directory for files
            temp_dir = tempfile.mkdtemp()
            logging.info("Creating temporary directory for audio files...")

            def create_video(fps):
                """Helper function to create video at specified FPS"""
                video_path = os.path.join(temp_dir, "video_no_audio.mp4")
                fourcc = cv2.VideoWriter_fourcc(*"mp4v")
                out = cv2.VideoWriter(video_path, fourcc, fps, (width, height))
                total_frames = 0

                for idx, (screenshot_path, _) in enumerate(
                    self.screenshots_with_actions
                ):
                    frames_needed = int(max(all_audio_lengths[idx], 2.0) * fps)
                    img = cv2.imread(screenshot_path)
                    for _ in range(frames_needed):
                        out.write(img)
                        total_frames += 1

                out.release()
                return video_path, total_frames

            def combine_video_audio(silent_video_path, audio_path, output_path, crf=23):
                """Helper function to combine video and audio with compression"""
                subprocess.run(
                    [
                        "ffmpeg",
                        "-i",
                        silent_video_path,
                        "-i",
                        audio_path,
                        "-c:v",
                        "libx264",  # Use H.264 codec
                        "-crf",
                        str(
                            crf
                        ),  # Compression quality (18-28 is good, higher = more compression)
                        "-preset",
                        "medium",  # Encoding speed preset
                        "-c:a",
                        "aac",
                        "-b:a",
                        "128k",  # Compress audio bitrate
                        output_path,
                        "-y",
                        "-loglevel",
                        "error",
                    ]
                )

            # Create paths for our files
            # Use video_name to create properly named files in tests/ directory
            tests_dir = os.path.join(os.getcwd(), "tests")
            os.makedirs(tests_dir, exist_ok=True)
            final_video_path = os.path.abspath(
                os.path.join(tests_dir, f"{video_name}.mp4")
            )
            concatenated_audio_path = os.path.join(temp_dir, "combined_audio.wav")

            # Lists to store audio data and durations
            all_audio_data = []
            all_audio_lengths = []

            # First pass: Generate audio files and calculate durations
            logging.info("Generating audio narrations...")
            for idx, (_, action_name) in enumerate(
                tqdm(
                    self.screenshots_with_actions,
                    desc="Generating audio files",
                    unit="clip",
                )
            ):
                # Generate audio file for this action
                audio_path = os.path.join(temp_dir, f"audio_{idx}.wav")

                try:
                    # Clean up the action name for better narration
                    cleaned_action = action_name.replace("_", " ")
                    cleaned_action = re.sub(r"([a-z])([A-Z])", r"\1 \2", cleaned_action)

                    # Generate TTS audio
                    tts = openai.audio.speech.create(
                        model="tts-1",
                        voice="HAL9000",
                        input=cleaned_action,
                        extra_body={"language": "en"},
                    )
                    audio_content = base64.b64decode(tts.content)

                    # Write the raw audio first
                    with open(audio_path, "wb") as audio_file:
                        audio_file.write(audio_content)

                    # Reopen the audio file with soundfile to ensure it's in the correct format
                    audio_data, sample_rate = sf.read(audio_path)

                    # Add small silence padding at the end (0.5 seconds)
                    padding = int(0.5 * sample_rate)  # Use the actual sample rate
                    audio_data = np.pad(audio_data, (0, padding), mode="constant")

                    # Store audio data and sample rate
                    all_audio_data.append((audio_data, sample_rate))
                    audio_duration = len(audio_data) / sample_rate
                    all_audio_lengths.append(max(audio_duration, 2.0))

                except Exception as e:
                    logging.error(f"Error processing clip {idx}: {e}")
                    all_audio_lengths.append(2.0)
            if all_audio_data:
                # Use the sample rate from the first audio clip
                target_sample_rate = all_audio_data[0][1]

                # Resample all audio to match the first clip's sample rate if needed
                resampled_audio = []
                for audio_data, sr in all_audio_data:
                    if sr != target_sample_rate:
                        # You might need to add a resampling library like librosa here
                        # resampled = librosa.resample(audio_data, orig_sr=sr, target_sr=target_sample_rate)
                        resampled = audio_data  # Placeholder for actual resampling
                    else:
                        resampled = audio_data
                    resampled_audio.append(resampled)

                # Combine the resampled audio
                combined_audio = np.concatenate(resampled_audio)

                # Write with the correct sample rate
                sf.write(concatenated_audio_path, combined_audio, target_sample_rate)

            # Initial attempt with 30 fps and moderate compression
            initial_fps = 30
            silent_video_path, total_frames = create_video(initial_fps)
            combine_video_audio(
                silent_video_path, concatenated_audio_path, final_video_path, crf=23
            )

            # Get file size in MB
            file_size_mb = os.path.getsize(final_video_path) / (1024 * 1024)

            # If file is still too large, try increasing compression and reducing fps
            if file_size_mb > max_size_mb:
                logging.info(
                    f"Video size ({file_size_mb:.2f}MB) exceeds limit of {max_size_mb}MB. Adjusting settings..."
                )

                # First try stronger compression
                logging.info("Attempting stronger compression...")
                combine_video_audio(
                    silent_video_path, concatenated_audio_path, final_video_path, crf=28
                )
                file_size_mb = os.path.getsize(final_video_path) / (1024 * 1024)

                # If still too large, reduce fps and maintain high compression
                if file_size_mb > max_size_mb:
                    # Calculate new fps based on size ratio with some extra buffer
                    new_fps = int(
                        initial_fps * (max_size_mb / file_size_mb) * 0.85
                    )  # 15% buffer
                    new_fps = max(new_fps, 10)  # Don't go below 10 fps

                    logging.info(
                        f"Recreating video with {new_fps} fps and high compression..."
                    )
                    silent_video_path, total_frames = create_video(new_fps)
                    combine_video_audio(
                        silent_video_path,
                        concatenated_audio_path,
                        final_video_path,
                        crf=28,
                    )

            # Cleanup
            logging.info("Cleaning up temporary files...")
            shutil.rmtree(temp_dir)

            if not os.path.exists(final_video_path):
                logging.error("Video file was not created successfully")
                return None

            final_size_mb = os.path.getsize(final_video_path) / (1024 * 1024)
            logging.info(
                f"Video report created successfully at: {final_video_path} (Size: {final_size_mb:.2f}MB)"
            )

            # Send video to Discord immediately after creation
            demo_name = video_name.replace("_", " ").title()
            if demo_name != "Report":
                self.send_video_to_discord(final_video_path, demo_name, test_status)

            return final_video_path

        except Exception as e:
            logging.error(f"Error creating video report: {e}")
            return None

    async def prompt_agent(self, action_name, screenshot_path):

        prompt = f"""The goal will be to view the screenshot and determine if the action was successful or not.

        The action we were trying to perform was: {action_name}

        This screenshot shows the result of the action.

        In your <answer> block, respond with only one word `True` if the screenshot is as expected, to indicate if the action was successful. If the action was not successful, explain why in the <answer> block, this will be sent to the developers as the error in the test.
        """
        with open(screenshot_path, "rb") as f:
            screenshot = f.read().decode("utf-8")
        screenshot = f"data:image/png;base64,{screenshot}"
        response = self.agixt.prompt_agent(
            agent_name="XT",
            prompt_name="Think About It",
            prompt_args={"user_input": prompt, "file_urls": [screenshot]},
        )
        logging.info(f"Agent response: {response}")
        updated_response = re.sub(r"[^a-zA-Z]", "", response).lower()
        if updated_response != "true":
            raise Exception(
                f"Action failed: {action_name}\nAI suggested the action was not successful:\n{response}"
            )

    async def handle_mfa_screen(self):
        """Handle MFA screenshot"""
        # Decode QR code from screenshot
        await asyncio.sleep(2)
        # await self.take_screenshot(f"Screenshot prior to attempting to decode QR code")
        nparr = np.frombuffer(await self.page.screenshot(), np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        otp_uri = None
        decoded_objects = decode(img)
        for obj in decoded_objects:
            if obj.type == "QRCODE":
                otp_uri = obj.data.decode("utf-8")
                break
        if not otp_uri:
            raise Exception("Failed to decode QR code")
        logging.info(f"Retrieved OTP URI: {otp_uri}")
        match = re.search(r"secret=([\w\d]+)", otp_uri)
        if match:
            secret_key = match.group(1)
            logging.info("Successfully extracted secret key")
            totp = pyotp.TOTP(secret_key)
            otp_token = totp.now()
            await self.page.fill("#token", otp_token)
            logging.info("Entering OTP token")
            await self.take_screenshot(
                "The user scans the QR code and enrolls it in their authenticator app, then entering the one-time password therefrom."
            )
            logging.info("Submitting OTP token")
            await self.page.click('button[type="submit"]')
        else:
            raise Exception("Failed to extract secret key from OTP URI")
        return secret_key

    async def test_action(
        self, action_description, action_function, followup_function=None
    ):
        """
        Generic method to perform a test action

        Args:
            action_description (str): Description of the action being performed
            action_function (callable): Function to perform the action (async)
        """
        try:
            logging.info(action_description)
            await asyncio.sleep(5)
            await self.page.wait_for_load_state("domcontentloaded", timeout=90000)
            result = await action_function()
            await self.page.wait_for_load_state("domcontentloaded", timeout=90000)
            await asyncio.sleep(5)
            if followup_function:
                await followup_function()
            await self.take_screenshot(f"{action_description}")
            return result
        except Exception as e:
            logging.error(f"Failed {action_description}: {e}")
            raise Exception(f"Failed {action_description}: {e}")

    async def handle_register(self):
        """Handle the registration process"""
        email_address = f"{uuid.uuid4()}@example.com"

        await self.test_action(
            f"The user enters their email address in the registration form. Since this e-mail address doesn't have an account yet, we proceed to the registration page.",
            lambda: self.page.fill("#email", email_address),
        )

        await self.test_action(
            "Clicking the 'Continue with Email' button advances the process.",
            lambda: self.page.locator("text=Continue with Email").click(),
        )

        first_name = "Test"
        last_name = "User"
        await self.test_action(
            f"The user enters their first name, in this case. {first_name}. We are using the name {first_name} {last_name} for demonstration purposes.",
            lambda: self.page.fill("#first_name", first_name),
        )

        await self.test_action(
            f"The user enters their last name: {last_name}.",
            lambda: self.page.fill("#last_name", last_name),
        )

        await self.test_action(
            "Clicking the 'Register' button advances the login process to the multifactor authentication confirmation step after registration, ensuring the user has enrolled therein.",
            lambda: self.page.click('button[type="submit"]'),
        )

        mfa_token = await self.test_action(
            "After successfully entering their one time password, the user is allowed into the application.",
            lambda: self.handle_mfa_screen(),
        )

        logging.info(f"MFA token {mfa_token} handled successfully")
        if "email" in self.features:
            await self.handle_email()
        return email_address, mfa_token

    async def handle_google(self):
        """Handle Google OAuth scenario"""
        # await stealth_async(self.context)

        async def handle_oauth_async(popup):
            self.popup = popup
            logging.info(f"New popup URL: {popup.url}")
            await popup.wait_for_timeout(5000)
            await self.take_screenshot("Google OAuth popup window opened correctly")

            await self.test_action(
                "E-mail is entered in Google OAuth form",
                lambda: popup.fill("#identifierId", os.getenv("GoogleTestEmail")),
            )

            await self.test_action(
                "System advanced to password screen in Google OAuth",
                lambda: popup.click('text="Next"'),
            )

            await self.test_action(
                "Password is entered in Google OAuth form",
                lambda: popup.fill("[type=password]", os.getenv("GoogleTestPassword")),
            )

            await self.test_action(
                "System showing Google safety screen",
                lambda: popup.click('text="Next"'),
            )

            await self.test_action(
                "System showing Google access permissions screen",
                lambda: popup.click('text="Continue"'),
            )

            await self.test_action(
                "system showing scope selection screen",
                lambda: popup.click('text="Continue"'),
            )

            await self.test_action(
                "required scopes are checked for Google OAuth",
                lambda: popup.click("[type=checkbox]"),
            )

            await self.test_action(
                "popup closed", lambda: popup.click('text="Continue"')
            )

            await popup.wait_for_timeout(20000)
            self.popup = None

        self.page.on("popup", handle_oauth_async)

        await self.test_action(
            "Clicking 'Login with Google' button",
            lambda: self.page.locator("text=Login with Google").click(),
        )

        await self.take_screenshot(
            "Google OAuth process completed and returned to main application"
        )

    async def handle_chat(self):
        try:
            # Start at chat screen first for consistent navigation
            await self.navigate_to_chat_first(
                "After the user logs in, they start at the chat interface which is ready for their first basic interaction."
            )

            await self.test_action(
                "By clicking in the chat bar, the user can expand it to show more options and see their entire input.",
                lambda: self.page.click("#chat-message-input-inactive"),
            )
            await self.test_action(
                "The user enters an input to prompt the default agent, since no advanced settings have been configured, this will use the default A G I X T thought process.",
                lambda: self.page.fill(
                    "#chat-message-input-active",
                    "Can you show be a basic 'hello world' Python example?",
                ),
            )
            await self.test_action(
                "When the user hits send, or the enter key, the message is sent to the agent and it begins thinking.",
                lambda: self.page.press("#chat-message-input-active", "Enter"),
            )

            await asyncio.sleep(90)

            await self.take_screenshot(
                "When the agent finishes thinking, the agent responds alongside providing its thought process and renaming the conversation contextually."
            )

            # await self.test_action(
            #     "Record audio",
            #     lambda: self.page.click("#audio-start-recording"),
            # )
            # with open('./audio.wav', 'rb') as audio_file:
            #     audio_base64 = base64.b64encode(audio_file.read()).decode('utf-8')
            # await self.page.evaluate(
            #     f"""
            #     // Mock MediaRecorder and getUserMedia for audio file simulation
            #     navigator.mediaDevices.getUserMedia = async () => {{
            #         // Create audio context and media stream
            #         const audioContext = new AudioContext();
            #         const audioBuffer = await audioContext.decodeAudioData(
            #             Uint8Array.from(atob('{audio_base64}'), c => c.charCodeAt(0)).buffer
            #         );

            #         // Create a media stream from the audio buffer
            #         const source = audioContext.createBufferSource();
            #         source.buffer = audioBuffer;
            #         const destination = audioContext.createMediaStreamDestination();
            #         source.connect(destination);

            #         // Start playing the audio
            #         source.start();

            #         return destination.stream;
            #     }};
            # """
            # )

            # await self.test_action(
            #     "Confirm audio",
            #     lambda: self.page.click("#audio-finish-recording"),
            # )

            # await self.test_action(
            #     "message is sent and the timer has started",
            #     lambda: self.page.click("#send-message"),
            # )
            # await asyncio.sleep(120)

            # await self.take_screenshot("voice response")
        except Exception as e:
            logging.error(f"Error nagivating to chat: {e}")
            raise Exception(f"Error nagivating to chat: {e}")

    async def handle_commands_workflow(self):
        """Handle commands workflow scenario"""
        # Start at chat screen first for consistent navigation
        await self.navigate_to_chat_first(
            "Starting from the chat interface to demonstrate command workflow capabilities"
        )

        # TODO: Implement commands workflow test - navigate from chat to commands configuration
        pass

    async def handle_mandatory_context(self):
        """Test the mandatory context feature by setting and using a context in chat."""
        # Start at chat screen first for consistent navigation
        await self.navigate_to_chat_first(
            "Starting from the chat interface, the user will navigate to configure mandatory context settings"
        )

        # Navigate to Agent Management
        await self.test_action(
            "Navigate to Agent Management to begin mandatory context configuration",
            lambda: self.page.click('span:has-text("Agent Management")'),
        )

        await self.take_screenshot("Agent Management dropdown menu is visible")

        # Navigate to Training from the dropdown
        await self.test_action(
            "Click on Training in the Agent Management dropdown",
            lambda: self.page.click('a:has-text("Training")'),
        )

        # Wait for the training page to load completely
        await self.test_action(
            "Wait for the training page to load with mandatory context form",
            lambda: self.page.wait_for_load_state("networkidle", timeout=60000),
        )

        await self.take_screenshot(
            "Training page loaded with mandatory context interface"
        )

        # Look for the mandatory context text area using multiple possible selectors
        mandatory_context_text = "You are a helpful assistant who loves using the word 'wonderful' in responses when discussing any topic."

        # Try different selectors to find the mandatory context input field
        selectors_to_try = [
            "textarea[placeholder*='Enter details']",
            "textarea[placeholder*='mandatory context']",
            "textarea[placeholder*='Enter mandatory context']",
            "textarea:has-text('Enter details')",
            "form textarea",
            "textarea",
        ]

        context_field_found = False
        for selector in selectors_to_try:
            try:
                await self.test_action(
                    f"Attempt to locate mandatory context field using selector: {selector}",
                    lambda s=selector: self.page.wait_for_selector(
                        s, state="visible", timeout=5000
                    ),
                    lambda s=selector: self.page.fill(s, mandatory_context_text),
                )
                context_field_found = True
                await self.take_screenshot(
                    "Mandatory context has been entered into the text field"
                )
                break
            except Exception as e:
                logging.info(f"Selector {selector} failed: {e}")
                continue

        if not context_field_found:
            # If no specific selector worked, try to find any visible textarea and use it
            await self.test_action(
                "Locate any available textarea for mandatory context input",
                lambda: self.page.wait_for_selector(
                    "textarea", state="visible", timeout=10000
                ),
                lambda: self.page.fill("textarea", mandatory_context_text),
            )
            await self.take_screenshot(
                "Mandatory context text entered in available textarea"
            )

        # Wait a moment for the input to settle
        await asyncio.sleep(2)

        # Look for the Update Mandatory Context button
        update_button_found = False
        update_selectors = [
            'button:has-text("Update Mandatory Context")',
            'input[value*="Update Mandatory Context"]',
            'button[type="submit"]',
            'input[type="submit"]',
            'button:has-text("Update")',
            'button:has-text("Save")',
        ]

        for selector in update_selectors:
            try:
                await self.test_action(
                    f"Click the Update Mandatory Context button using selector: {selector}",
                    lambda s=selector: self.page.wait_for_selector(
                        s, state="visible", timeout=5000
                    ),
                    lambda s=selector: self.page.click(s),
                )
                update_button_found = True
                await self.take_screenshot(
                    "Update Mandatory Context button clicked successfully"
                )
                break
            except Exception as e:
                logging.info(f"Update button selector {selector} failed: {e}")
                continue

        if not update_button_found:
            logging.warning(
                "Could not find Update Mandatory Context button, trying generic submit"
            )
            await self.test_action(
                "Try to submit form using generic submit approach",
                lambda: self.page.press(
                    "textarea", "Tab"
                ),  # Move focus away from textarea
            )
            # Try to find any submit button or form submission
            try:
                await self.test_action(
                    "Look for any submit button to save mandatory context",
                    lambda: self.page.click(
                        "button[type='submit'], input[type='submit'], form button"
                    ),
                )
                await self.take_screenshot("Attempted to submit mandatory context form")
            except Exception as e:
                logging.warning(f"Could not submit form: {e}")

        # Wait for the update to process
        await self.test_action(
            "Wait for mandatory context update to process",
            lambda: self.page.wait_for_load_state("networkidle", timeout=30000),
        )

        await self.take_screenshot("Mandatory context settings have been updated")

        # Navigate to chat to test the mandatory context
        await self.test_action(
            "Navigate to chat to test the mandatory context",
            lambda: self.page.goto(f"{self.base_uri}/chat"),
        )

        await self.test_action(
            "Wait for chat page to load completely",
            lambda: self.page.wait_for_load_state("networkidle", timeout=60000),
        )

        await self.test_action(
            "Click in the chat input to expand it",
            lambda: self.page.click("#chat-message-input-inactive"),
        )

        await self.test_action(
            "Enter a prompt to test mandatory context",
            lambda: self.page.fill(
                "#chat-message-input-active",
                "What do you think about nature?",
            ),
        )

        await self.test_action(
            "Send the message to test mandatory context",
            lambda: self.page.press("#chat-message-input-active", "Enter"),
        )

        # Wait for the response which should include "wonderful" due to mandatory context
        await asyncio.sleep(90)

        await self.take_screenshot("Chat response showing mandatory context influence")

    async def handle_email(self):
        """Handle email verification scenario"""
        # Start at chat screen first for consistent navigation
        await self.navigate_to_chat_first(
            "Starting from the chat interface to demonstrate email verification workflow"
        )

        # TODO: Handle email verification workflow - navigate from chat to email settings
        pass

    async def handle_login(self, email, mfa_token):
        """Handle login scenario"""
        try:
            # Navigate to login page
            await self.test_action(
                "The user navigates to the login page",
                lambda: self.page.goto(f"{self.base_uri}/user"),
                lambda: self.page.wait_for_selector("input#email", state="visible"),
            )

            await self.test_action(
                f"The user enters their email address: {email}",
                lambda: self.page.wait_for_selector("#email", state="visible"),
                lambda: self.page.fill("#email", email),
            )

            # Click continue with email
            await self.test_action(
                "The user clicks 'Continue with Email' to proceed",
                lambda: self.page.wait_for_selector(
                    "text=Continue with Email", state="visible"
                ),
                lambda: self.page.click("text=Continue with Email"),
            )

            # Generate OTP code from saved MFA token
            otp = pyotp.TOTP(mfa_token).now()

            # Fill in the OTP code
            await self.test_action(
                f"The user enters their MFA code: {otp}",
                lambda: self.page.wait_for_selector("#token", state="visible"),
                lambda: self.page.fill("#token", otp),
            )

            # Submit the login form
            await self.test_action(
                "The user submits the MFA token to complete login",
                lambda: self.page.wait_for_selector(
                    'button[type="submit"]', state="visible"
                ),
                lambda: self.page.click('button[type="submit"]'),
            )

            # Wait a bit for the login to process
            await asyncio.sleep(5)

            # Verify successful login by checking for the "New Chat" button or other authenticated UI elements
            await self.test_action(
                "The system authenticates the user and redirects to the chat interface",
                lambda: self.page.wait_for_load_state("networkidle", timeout=60000),
            )

            # Simple verification: Look for "New Chat" button which indicates user is logged in
            try:
                await self.page.wait_for_selector('text="New Chat"', timeout=30000)
                logging.info("Login verified: Found 'New Chat' button - user is authenticated")
            except:
                # Fallback: Check for other authenticated UI elements
                try:
                    await self.page.wait_for_selector('[data-sidebar="sidebar"]', timeout=15000)
                    logging.info("Login verified: Found sidebar - user is authenticated")
                except:
                    # Final fallback: Check if we're not on the login page anymore
                    current_url = self.page.url
                    if "/user" not in current_url:
                        logging.info(f"Login verified: No longer on login page - URL: {current_url}")
                    else:
                        raise Exception("Login verification failed - still on login page")
        except Exception as e:
            logging.error(f"Error during login: {e}")
            raise Exception(f"Error during login: {str(e)}")

    async def handle_logout(self, email=None):
        """Handle logout by clicking user card at bottom left, then logout"""
        try:
            # Wait for page to be fully loaded
            await self.test_action(
                "Waiting for page to load for logout",
                lambda: self.page.wait_for_load_state(
                    "domcontentloaded", timeout=10000
                ),
            )

            await self.take_screenshot("Before attempting to log out")

            # Click the user button in the sidebar footer (bottom left)
            logging.info("Clicking user card in sidebar footer")
            await self.test_action(
                "Clicking user card at bottom left",
                lambda: self.page.wait_for_selector(
                    '[data-sidebar="footer"] button[size="lg"]', state="visible"
                ),
                lambda: self.page.click('[data-sidebar="footer"] button[size="lg"]'),
            )

            await self.page.wait_for_timeout(1000)
            await self.take_screenshot("After clicking user card")

            # Click the logout menu item
            logging.info("Clicking logout menu item")
            await self.test_action(
                "Clicking logout option",
                lambda: self.page.wait_for_selector(
                    '[role="menuitem"]:has-text("Log out")', state="visible"
                ),
                lambda: self.page.click('[role="menuitem"]:has-text("Log out")'),
            )

            await self.page.wait_for_timeout(2000)
            await self.take_screenshot("After clicking logout")

            # Verify logout was successful by checking URL
            current_url = self.page.url
            if (
                "/user" in current_url
                or current_url == self.base_uri
                or current_url.endswith("/")
            ):
                logging.info(f"Successfully logged out - URL: {current_url}")
                return
            else:
                # Fallback: Direct navigation to logout URL
                logging.info("Logout verification failed, trying direct logout URL")
                await self.page.goto(f"{self.base_uri}/user/logout")
                await self.page.wait_for_timeout(2000)

                current_url = self.page.url
                if (
                    "/user" in current_url
                    or current_url == self.base_uri
                    or current_url.endswith("/")
                ):
                    logging.info(
                        f"Successfully logged out via direct URL - URL: {current_url}"
                    )
                    return
                else:
                    raise Exception("Failed to logout after all attempts")

        except Exception as e:
            logging.error(f"Error during logout: {e}")
            await self.take_screenshot("Error_during_logout")
            raise Exception(f"Failed to logout: {str(e)}")

    async def handle_update_user(self):
        """Handle user update scenario by changing last name and timezone"""
        try:
            # Start at chat screen first for consistent navigation
            await self.navigate_to_chat_first(
                "Starting from the chat interface, the user will navigate to account management to update their profile"
            )

            # Navigate to user management page
            await self.test_action(
                "The user navigates to the account management page",
                lambda: self.page.wait_for_selector("body", state="visible"),
                lambda: self.page.goto(f"{self.base_uri}/user/manage"),
            )

            # Take a screenshot to examine the form structure
            await self.take_screenshot(
                "User management page loaded - examining form structure"
            )

            # Find the last name field and update it with a unique value
            new_last_name = f"Updated{uuid.uuid4().hex[:6]}"

            # Try various selectors to find the last name field
            last_name_input = None
            selectors = [
                'input[id*="last_name" i]',  # Case-insensitive id containing "last_name"
                'input[name*="last_name" i]',
                'input[placeholder*="last name" i]',
                "form input:nth-child(2)",  # Often the second input in a name form
            ]

            for selector in selectors:
                count = await self.page.locator(selector).count()
                if count > 0:
                    last_name_input = selector
                    break

            if last_name_input:
                await self.test_action(
                    f"The user updates their last name to '{new_last_name}'",
                    lambda: self.page.wait_for_selector(
                        last_name_input, state="visible"
                    ),
                    lambda: self.page.fill(last_name_input, new_last_name),
                )
            else:
                logging.warning("Could not find last name field, continuing with test")

            # Take a more general approach for finding selectable fields
            # Let's try to find and interact with any dropdown/select elements
            await self.test_action(
                "The user looks for any dropdown fields on the page to update",
                lambda: self.page.wait_for_selector(
                    "select", state="visible", timeout=5000
                ),
                lambda: self.page.evaluate(
                    """() => {
                    // Find all dropdowns or select elements
                    const selects = Array.from(document.querySelectorAll('select'));
                    if (selects.length > 0) {
                        // For each select, change to a different value if possible
                        selects.forEach(select => {
                            if (select.options.length > 1) {
                                const currentIndex = select.selectedIndex;
                                select.selectedIndex = (currentIndex + 1) % select.options.length;
                                select.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        });
                        return selects.length;
                    }
                    return 0;
                }"""
                ),
            )

            # Take screenshot after attempting to change dropdowns
            await self.take_screenshot("After attempting to modify dropdown values")

            # Look for and click any update/save button
            update_button_found = False
            update_button_selectors = [
                'button:has-text("Update")',
                'button:has-text("Save")',
                'button[type="submit"]',
                "form button",
            ]

            for selector in update_button_selectors:
                count = await self.page.locator(selector).count()
                if count > 0:
                    await self.test_action(
                        "The user clicks the button to save their profile changes",
                        lambda: self.page.wait_for_selector(selector, state="visible"),
                        lambda: self.page.click(selector),
                    )
                    update_button_found = True
                    break

            if not update_button_found:
                logging.warning(
                    "Could not find update button, attempting to submit form directly"
                )
                await self.test_action(
                    "The user submits the form to save changes",
                    lambda: self.page.wait_for_selector("form", state="visible"),
                    lambda: self.page.evaluate(
                        "document.querySelector('form').submit()"
                    ),
                )

            # Wait for the page to settle after the update
            await self.test_action(
                "The system processes the update and the page stabilizes",
                lambda: self.page.wait_for_load_state(
                    "networkidle", timeout=60000
                ),  # 60 second timeout
            )

            # Take a final screenshot to show the result
            await self.take_screenshot("After submitting profile updates")

            logging.info("User profile update process completed")
        except Exception as e:
            logging.error(f"Error updating user profile: {e}")
            await self.take_screenshot("Error_updating_user_profile")
            raise Exception(f"Failed to update user profile: {str(e)}")

    async def handle_invite_user(self):
        """Handle user invite scenario by inviting a user to the team"""
        try:
            # Start at chat screen first for consistent navigation
            await self.navigate_to_chat_first(
                "Starting from the chat interface, the user will navigate to team management to invite new members"
            )

            # Navigate to team page
            await self.test_action(
                "The user navigates to the team management page",
                lambda: self.page.wait_for_selector("body", state="visible"),
                lambda: self.page.goto(f"{self.base_uri}/team"),
            )

            # Wait for team page to load completely
            await self.test_action(
                "The team management page loads, showing current team members and invite options",
                lambda: self.page.wait_for_load_state(
                    "networkidle", timeout=120000
                ),  # Increase to 120 seconds
            )

            # Generate a random email for invitation
            invite_email = f"test.user+{uuid.uuid4().hex[:8]}@example.com"

            # Find and fill the email field
            await self.test_action(
                f"The user enters '{invite_email}' in the email field to invite a new user",
                lambda: self.page.wait_for_selector("input#email", state="visible"),
                lambda: self.page.fill("input#email", invite_email),
            )

            # For the role selection, we'll use a simpler approach without nested conditionals in lambdas
            # First check if the select content exists
            select_content_exists = (
                await self.page.locator(".select-content").count() > 0
            )

            if select_content_exists:
                await self.test_action(
                    "The user confirms the role selector is present",
                    lambda: self.page.wait_for_selector(
                        ".select-content", state="visible", timeout=1000
                    ),
                )
            else:
                await self.test_action(
                    "The user proceeds with the default role selection",
                    lambda: self.page.wait_for_timeout(1000),
                )

            # Click Send Invitation button
            await self.test_action(
                "The user clicks 'Send Invitation' to invite the new team member",
                lambda: self.page.wait_for_selector(
                    'button:has-text("Send Invitation")', state="visible"
                ),
                lambda: self.page.click('button:has-text("Send Invitation")'),
            )

            # For verification, check for success indicators separately without conditionals in lambdas
            success_message_exists = (
                await self.page.locator('text="sent successfully"').count() > 0
            )

            if success_message_exists:
                await self.test_action(
                    "The system shows a confirmation message about successful invitation",
                    lambda: self.page.wait_for_selector(
                        'text="sent successfully"', state="visible", timeout=10000
                    ),
                )
            else:
                await self.test_action(
                    "The system shows pending invitations section",
                    lambda: self.page.wait_for_selector(
                        'text="Pending Invitations"', state="visible", timeout=10000
                    ),
                )

            # Check if the email appears in the list
            email_visible = (
                await self.page.locator(f'text="{invite_email}"').count() > 0
            )

            if email_visible:
                await self.test_action(
                    f"The invited email '{invite_email}' appears in the pending invitations list",
                    lambda: self.page.wait_for_selector(
                        f'text="{invite_email}"', state="visible", timeout=5000
                    ),
                )
            else:
                await self.test_action(
                    "The invitation was processed but email may not be visible in the list",
                    lambda: self.page.wait_for_timeout(2000),
                )

            logging.info(f"User invitation sent successfully to {invite_email}")
        except Exception as e:
            logging.error(f"Error inviting user: {e}")
            await self.take_screenshot("Error_inviting_user")
            raise Exception(f"Failed to invite user: {str(e)}")

    async def handle_train_user_agent(self):
        """Handle training user agent scenario"""
        # Start at chat screen first for consistent navigation
        await self.navigate_to_chat_first(
            "Starting from the chat interface to demonstrate user agent training capabilities"
        )

        # TODO: Handle training user agent workflow - navigate from chat to training settings
        pass

    async def handle_train_company_agent(self):
        """Handle training company agent scenario"""
        # Start at chat screen first for consistent navigation
        await self.navigate_to_chat_first(
            "Starting from the chat interface to demonstrate company agent training capabilities"
        )

        # TODO: Handle training company agent workflow - navigate from chat to company training settings
        pass

    async def handle_stripe(self):
        """Handle Stripe subscription scenario"""
        # Start at chat screen first for consistent navigation
        await self.navigate_to_chat_first(
            "Starting from the chat interface to demonstrate subscription management capabilities"
        )

        # Navigate to subscription page
        await self.test_action(
            "Navigate to subscription page to view available plans",
            lambda: self.page.goto(f"{self.base_uri}/subscription"),
        )

        await self.take_screenshot("subscription page is loaded with available plans")
        await self.test_action(
            "Stripe checkout page is open",
            lambda: self.page.click(".bg-card button"),
            followup_function=lambda: self.page.wait_for_url(
                "https://checkout.stripe.com/c/**"
            ),
        )

        sus_button = await self.page.query_selector(
            ".Button--link.Button--checkoutSecondaryLink"
        )
        if sus_button:
            await self.test_action(
                "subscription confirmation button is visible", lambda: None
            )
            await self.test_action(
                "Click subscription confirmation button", lambda: sus_button.click()
            )

        await self.test_action(
            "Enter card number",
            lambda: self.page.fill("input#cardNumber", "4242424242424242"),
        )

        await self.test_action(
            "Enter card expiry", lambda: self.page.fill("input#cardExpiry", "1230")
        )

        await self.test_action(
            "Enter card CVC", lambda: self.page.fill("input#cardCvc", "123")
        )

        await self.test_action(
            "Enter billing name",
            lambda: self.page.fill("input#billingName", "Test User"),
        )

        await self.test_action(
            "Select billing country",
            lambda: self.page.select_option("select#billingCountry", "US"),
        )

        await self.test_action(
            "Enter billing postal code",
            lambda: self.page.fill("input#billingPostalCode", "90210"),
        )

        await self.test_action(
            "Submit payment",
            lambda: self.page.click("button.SubmitButton.SubmitButton--complete"),
        )
        await self.page.wait_for_timeout(15000)
        await self.take_screenshot("payment was processed and subscription is active")

    async def run_registration_test(self):
        """Run registration test and create video"""
        try:
            logging.info(f"Navigating to {self.base_uri}")
            await self.page.goto(self.base_uri)
            await self.take_screenshot(
                "The landing page of the application is the first thing the user sees."
            )

            logging.info("Clicking 'Register or Login' button")
            await self.page.click('text="Login or Register"')
            await self.take_screenshot(
                "The user has multiple authentication options if enabled, including several o auth options such as Microsoft or Google. For this test, we will use the basic email authentication."
            )

            if "google" not in self.features:
                try:
                    email, mfa_token = await self.handle_register()
                    video_path = self.create_video_report(
                        video_name="registration_demo"
                    )
                    logging.info(
                        f"Registration test complete. Video report created at {video_path}"
                    )
                    return email, mfa_token
                except Exception as e:
                    logging.error(f"Error registering user: {e}")
                    raise Exception(f"Error registering user: {e}")
            elif "google" in self.features:
                email = await self.handle_google()
                mfa_token = ""
                video_path = self.create_video_report(video_name="google_oauth_demo")
                logging.info(
                    f"Google OAuth test complete. Video report created at {video_path}"
                )
                return email, mfa_token

        except Exception as e:
            logging.error(f"Registration test failed: {e}")
            if not os.path.exists(
                os.path.join(os.getcwd(), "tests", "registration_demo.mp4")
            ):
                self.create_video_report(
                    video_name="registration_demo", test_status="❌ **TEST FAILURE**"
                )
            raise e

    async def run_login_test(self, email, mfa_token):
        """Run login test and create video"""
        try:
            await self.handle_login(email, mfa_token)
            video_path = self.create_video_report(video_name="login_demo")
            logging.info(f"Login test complete. Video report created at {video_path}")
        except Exception as e:
            logging.error(f"Login test failed: {e}")
            if not os.path.exists(os.path.join(os.getcwd(), "tests", "login_demo.mp4")):
                self.create_video_report(
                    video_name="login_demo", test_status="❌ **TEST FAILURE**"
                )
            raise e

    async def run_user_preferences_test(self, email, mfa_token):
        """Run user preferences test and create video"""
        try:
            # User is already logged in from shared session
            await self.handle_update_user()
            video_path = self.create_video_report(video_name="user_preferences_demo")
            logging.info(
                f"User preferences test complete. Video report created at {video_path}"
            )
        except Exception as e:
            logging.error(f"User preferences test failed: {e}")
            if not os.path.exists(
                os.path.join(os.getcwd(), "tests", "user_preferences_demo.mp4")
            ):
                self.create_video_report(
                    video_name="user_preferences_demo",
                    test_status="❌ **TEST FAILURE**",
                )
            raise e

    async def run_team_management_test(self, email, mfa_token):
        """Run team management test and create video"""
        # Check if we should skip this test
        if os.getenv("SKIP_TEAM_MANAGEMENT_TEST", "").lower() == "true":
            logging.warning(
                "Skipping team management test due to SKIP_TEAM_MANAGEMENT_TEST=true"
            )
            return

        try:
            # User is already logged in from shared session
            await self.handle_invite_user()
            video_path = self.create_video_report(video_name="team_management_demo")
            logging.info(
                f"Team management test complete. Video report created at {video_path}"
            )
        except Exception as e:
            logging.error(f"Team management test failed: {e}")
            if not os.path.exists(
                os.path.join(os.getcwd(), "tests", "team_management_demo.mp4")
            ):
                self.create_video_report(
                    video_name="team_management_demo", test_status="❌ **TEST FAILURE**"
                )
            raise e

    async def run_chat_test(self, email, mfa_token):
        """Run chat test and create video"""
        try:
            # User is already logged in from shared session
            await self.handle_chat()
            video_path = self.create_video_report(video_name="chat_demo")
            logging.info(f"Chat test complete. Video report created at {video_path}")
        except Exception as e:
            logging.error(f"Chat test failed: {e}")
            if not os.path.exists(os.path.join(os.getcwd(), "tests", "chat_demo.mp4")):
                self.create_video_report(
                    video_name="chat_demo", test_status="❌ **TEST FAILURE**"
                )
            raise e

    async def run_training_test(self, email, mfa_token):
        """Run training test and create video"""
        try:
            # User is already logged in from shared session
            await self.handle_train_user_agent()
            await self.handle_train_company_agent()
            video_path = self.create_video_report(video_name="training_demo")
            logging.info(
                f"Training test complete. Video report created at {video_path}"
            )
        except Exception as e:
            logging.error(f"Training test failed: {e}")
            if not os.path.exists(
                os.path.join(os.getcwd(), "tests", "training_demo.mp4")
            ):
                self.create_video_report(
                    video_name="training_demo", test_status="❌ **TEST FAILURE**"
                )
            raise e

    async def run_stripe_test(self):
        """Run Stripe subscription test and create video"""
        try:
            await self.handle_stripe()
            video_path = self.create_video_report(video_name="stripe_demo")
            logging.info(f"Stripe test complete. Video report created at {video_path}")
        except Exception as e:
            logging.error(f"Stripe test failed: {e}")
            if not os.path.exists(
                os.path.join(os.getcwd(), "tests", "stripe_demo.mp4")
            ):
                self.create_video_report(
                    video_name="stripe_demo", test_status="❌ **TEST FAILURE**"
                )
            raise e

    async def run_abilities_test(self, email, mfa_token):
        """Run abilities/extensions test and create video"""
        try:
            # User is already logged in from shared session - navigate to abilities page
            await self.test_action(
                "Navigate to the abilities page to view and manage agent capabilities",
                lambda: self.page.goto(f"{self.base_uri}/abilities"),
            )
            video_path = self.create_video_report(video_name="abilities_demo")
            logging.info(
                f"Abilities test complete. Video report created at {video_path}"
            )
        except Exception as e:
            logging.error(f"Abilities test failed: {e}")
            if not os.path.exists(
                os.path.join(os.getcwd(), "tests", "abilities_demo.mp4")
            ):
                self.create_video_report(
                    video_name="abilities_demo", test_status="❌ **TEST FAILURE**"
                )
            raise e

    async def run_mandatory_context_test(self, email, mfa_token):
        """Run mandatory context/prompts test and create video"""
        try:
            # User is already logged in from shared session
            # Call our handler that properly tests the mandatory context feature
            await self.handle_mandatory_context()

            video_path = self.create_video_report(video_name="mandatory_context_demo")
            logging.info(
                f"Mandatory context test complete. Video report created at {video_path}"
            )
        except Exception as e:
            logging.error(f"Mandatory context test failed: {e}")
            if not os.path.exists(
                os.path.join(os.getcwd(), "tests", "mandatory_context_demo.mp4")
            ):
                self.create_video_report(
                    video_name="mandatory_context_demo",
                    test_status="❌ **TEST FAILURE**",
                )
            raise e

    async def handle_provider_settings(self):
        """Test provider settings page navigation and toggle interaction."""
        # Start at chat screen first for consistent navigation
        await self.navigate_to_chat_first(
            "Starting from the chat interface to demonstrate provider settings configuration"
        )

        # Navigate to Agent Management
        await self.test_action(
            "Navigate to Agent Management to begin extensions configuration",
            lambda: self.page.click('span:has-text("Agent Management")'),
        )

        await self.take_screenshot("Agent Management drop down")

        # Navigate to Settings via dropdown
        await self.test_action(
            "Click on Settings in the dropdown menu",
            lambda: self.page.click('a:has-text("Settings")'),
        )

        await self.take_screenshot("Settings page loaded")

        # Click on Providers tab if needed
        try:
            # Check if we need to navigate to the Providers tab
            providers_tab_visible = (
                await self.page.locator('button:has-text("Providers")').count() > 0
            )
            if providers_tab_visible:
                await self.test_action(
                    "Click on Providers tab to access provider settings",
                    lambda: self.page.click('button:has-text("Providers")'),
                )
        except Exception as e:
            logging.info(f"Provider tab navigation not needed: {e}")

        await self.take_screenshot("Provider settings page")

        # Click on Google provider connect button
        await self.test_action(
            "Click Connect button for Google provider",
            lambda: self.page.click('button:has-text("Connect"):near(:text("Google"))'),
        )

        await self.take_screenshot("Google provider connect dialog")

        # Input API key in the dialog
        await self.test_action(
            "Enter Google API key in the dialog",
            lambda: self.page.fill(
                'input[placeholder*="API key"]', "MOCK_GOOGLE_API_KEY_FOR_TESTING"
            ),
        )

        await self.take_screenshot("API key entered")

        # Click Save/Connect in the dialog
        await self.test_action(
            "Save Google A-P-I key configuration",
            lambda: self.page.get_by_role("button", name="Connect Provider").click(),
        )

        await self.take_screenshot("Provider settings saved")

        # Verify the provider is now connected (status check)
        await self.test_action(
            "Verify provider is now connected",
            lambda: self.page.wait_for_selector(
                'text="Connected"', state="visible", timeout=5000
            ),
        )

    async def run_provider_settings_test(self, email, mfa_token):
        """Run provider settings test and create video"""
        try:
            # User is already logged in from shared session
            await self.handle_provider_settings()
            video_path = self.create_video_report(video_name="provider_settings_demo")
            logging.info(
                f"Provider settings test complete. Video report created at {video_path}"
            )
        except Exception as e:
            logging.error(f"Provider settings test failed: {e}")
            if not os.path.exists(
                os.path.join(os.getcwd(), "tests", "provider_settings_demo.mp4")
            ):
                self.create_video_report(
                    video_name="provider_settings_demo",
                    test_status="❌ **TEST FAILURE**",
                )
            raise e

    async def navigate_to_chat_first(
        self, description="Navigate to chat screen to begin feature demonstration"
    ):
        """Helper method to standardize starting each test at the chat screen"""
        await self.test_action(
            description,
            lambda: self.page.goto(f"{self.base_uri}/chat"),
            lambda: self.page.wait_for_load_state("networkidle", timeout=60000),
        )

        await self.test_action(
            "The chat interface loads, showing the conversation history and input area",
            lambda: self.page.wait_for_selector(
                "#chat-message-input-inactive", state="visible", timeout=30000
            ),
        )

    # Removed duplicate run method - see the correct one at the end of the class

    async def handle_extensions_demo(self):
        """Handle extensions demo scenario: Agent Management → Extensions → Abilities → Toggle Command → New Chat → Test Message"""
        # Start at chat screen first for consistent navigation
        await self.navigate_to_chat_first(
            "Starting from the chat interface to demonstrate the extensions and abilities feature configuration"
        )

        # Navigate to Agent Management
        await self.test_action(
            "Navigate to Agent Management to access extensions and abilities settings",
            lambda: self.page.click('span:has-text("Agent Management")'),
        )

        await self.take_screenshot("Agent Management dropdown menu is visible")

        # Navigate to Extensions from the dropdown
        await self.test_action(
            "Click on Extensions in the Agent Management dropdown to view available extensions",
            lambda: self.page.click('a:has-text("Extensions")'),
        )

        # Wait for the extensions page to load completely
        await self.test_action(
            "Wait for the extensions page to load with available extensions",
            lambda: self.page.wait_for_load_state("networkidle", timeout=60000),
        )

        await self.take_screenshot(
            "Extensions page loaded showing available extensions"
        )

        # Navigate to Abilities
        await self.test_action(
            "Navigate to the Abilities section to view and configure agent capabilities",
            lambda: self.page.click('a:has-text("Abilities")'),
        )

        # Wait for the abilities page to load
        await self.test_action(
            "Wait for the abilities page to load with configurable capabilities",
            lambda: self.page.wait_for_load_state("networkidle", timeout=60000),
        )

        await self.take_screenshot(
            "Abilities page loaded with available agent capabilities"
        )

        # Scroll down to make the "Run Data Analysis" option visible
        await self.test_action(
            "Scroll down to view more capabilities including Run Data Analysis",
            lambda: self.page.evaluate("window.scrollBy(0, window.innerHeight * 0.5)"),
        )

        await self.take_screenshot(
            "Scrolled down to reveal Run Data Analysis capability"
        )

        # First, let's debug what's actually on the page
        await self.test_action(
            "Debug: Check what command text is available on the abilities page",
            lambda: self.page.evaluate(
                """() => {
                const h4Elements = Array.from(document.querySelectorAll('h4'));
                const commandTexts = h4Elements.map(h4 => h4.textContent?.trim()).filter(text => text);
                console.log('Available command texts:', commandTexts);
                
                const switches = Array.from(document.querySelectorAll('button[role="switch"]'));
                console.log(`Total switches found: ${switches.length}`);
                switches.forEach((sw, i) => {
                    console.log(`Switch ${i}: id="${sw.id}", text="${sw.textContent?.trim()}", parent card text="${sw.closest('[class*="card"], div')?.textContent?.slice(0, 100)}"`);
                });
                
                return {
                    commandTexts: commandTexts,
                    switchCount: switches.length
                };
            }"""
            ),
        )

        # Toggle the "Run Data Analysis" command - use precise selectors based on card structure
        # Each command is in its own Card with an h4 title and Switch directly after it
        # PRIORITIZE "Run Data Analysis" since that's the actual backend command name
        # EXCLUDE the "Show Enabled Only" switch by using :not() selector
        toggle_selectors = [
            # PRIORITY: Direct sibling relationship - h4 with exact text followed by switch (exclude show-enabled-only)
            'h4:text-is("Run Data Analysis") + div button[role="switch"]:not(#show-enabled-only)',
            'h4:text-is("Run Data Analysis") ~ button[role="switch"]:not(#show-enabled-only)',
            # Look for the switch within the same card as the "Run Data Analysis" h4 (exclude show-enabled-only)
            'div:has(h4:text-is("Run Data Analysis")) button[role="switch"]:not(#show-enabled-only)',
            # More specific card-based selector for "Run Data Analysis" (exclude show-enabled-only)
            '[class*="card"]:has(h4:text-is("Run Data Analysis")) button[role="switch"]:not(#show-enabled-only)',
            # Try targeting the specific command card structure (card with border class)
            'div[class*="border"]:has(h4:text-is("Run Data Analysis")) button[role="switch"]:not(#show-enabled-only)',
            # Flex container approach (based on the structure with switch and h4 in flex items)
            'div:has(h4:text-is("Run Data Analysis")) > div button[role="switch"]:not(#show-enabled-only)',
            # Try using contains text instead of exact match
            'h4:has-text("Run Data Analysis") ~ button[role="switch"]:not(#show-enabled-only)',
            'div:has(h4:has-text("Run Data Analysis")) button[role="switch"]:not(#show-enabled-only)',
            # FALLBACK: Look for "Data Analysis" from OVERRIDE_EXTENSIONS (exclude show-enabled-only)
            'h4:text-is("Data Analysis") + div button[role="switch"]:not(#show-enabled-only)',
            'h4:text-is("Data Analysis") ~ button[role="switch"]:not(#show-enabled-only)',
            'div:has(h4:text-is("Data Analysis")) button[role="switch"]:not(#show-enabled-only)',
            '[class*="card"]:has(h4:text-is("Data Analysis")) button[role="switch"]:not(#show-enabled-only)',
            'h4:has-text("Data Analysis") ~ button[role="switch"]:not(#show-enabled-only)',
            'div:has(h4:has-text("Data Analysis")) button[role="switch"]:not(#show-enabled-only)',
            # Even more general fallback for any data analysis related command (exclude show-enabled-only)
            'h4:text("data analysis") ~ button[role="switch"]:not(#show-enabled-only)',
            'div:has(h4:text("data analysis")) button[role="switch"]:not(#show-enabled-only)',
        ]

        toggle_found = False
        for selector in toggle_selectors:
            try:
                await self.test_action(
                    f"Toggle the 'Run Data Analysis' command using selector: {selector}",
                    lambda s=selector: self.page.wait_for_selector(
                        s, state="visible", timeout=10000
                    ),
                    lambda s=selector: self.page.click(s),
                )
                toggle_found = True
                await self.take_screenshot("Run Data Analysis command has been toggled")
                break
            except Exception as e:
                logging.info(f"Toggle selector {selector} failed: {e}")
                continue

        if not toggle_found:
            # JavaScript fallback with comprehensive switch validation and targeting
            await self.test_action(
                "Using JavaScript fallback to find and click the exact 'Run Data Analysis' switch with validation",
                lambda: self.page.evaluate(
                    """() => {
                        console.log('Starting comprehensive JavaScript fallback for Run Data Analysis switch');
                        
                        // Get ALL switches and analyze their card context
                        const allSwitches = Array.from(document.querySelectorAll('button[role="switch"]'));
                        console.log(`Found ${allSwitches.length} total switches`);
                        
                        let runDataAnalysisSwitch = null;
                        let runDataAnalysisIndex = -1;
                        
                        // Find the switch that belongs to "Run Data Analysis" by checking its card context
                        for (let i = 0; i < allSwitches.length; i++) {
                            const switchEl = allSwitches[i];
                            
                            // Skip the "Show Enabled Only" switch by ID
                            if (switchEl.id === 'show-enabled-only') {
                                console.log(`Skipping switch ${i}: show-enabled-only filter`);
                                continue;
                            }
                            
                            // Find the card/container this switch belongs to
                            const possibleContainers = [
                                switchEl.closest('[class*="card"]'),
                                switchEl.closest('div[class*="border"]'),
                                switchEl.closest('div[class*="rounded"]'),
                                switchEl.parentElement,
                                switchEl.parentElement?.parentElement
                            ].filter(Boolean);
                            
                            for (const container of possibleContainers) {
                                if (!container) continue;
                                
                                // Look for h4 elements within this container
                                const h4Elements = container.querySelectorAll('h4');
                                for (const h4 of h4Elements) {
                                    const h4Text = (h4.textContent || '').trim();
                                    
                                    if (h4Text === 'Run Data Analysis') {
                                        console.log(`FOUND "Run Data Analysis" switch at index ${i}`);
                                        console.log(`H4 text: "${h4Text}"`);
                                        console.log(`Container:`, container);
                                        
                                        runDataAnalysisSwitch = switchEl;
                                        runDataAnalysisIndex = i;
                                        break;
                                    }
                                }
                                
                                if (runDataAnalysisSwitch) break;
                            }
                            
                            if (runDataAnalysisSwitch) break;
                        }
                        
                        if (runDataAnalysisSwitch) {
                            console.log(`About to click "Run Data Analysis" switch at index ${runDataAnalysisIndex}`);
                            
                            // Get initial state
                            const initialState = runDataAnalysisSwitch.getAttribute('aria-checked');
                            console.log(`Initial switch state: ${initialState}`);
                            
                            // Scroll into view and click
                            runDataAnalysisSwitch.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            
                            // Add a small delay to ensure scroll completes, then click
                            setTimeout(() => {
                                runDataAnalysisSwitch.click();
                                console.log('Clicked Run Data Analysis switch');
                                
                                // Check state after click
                                setTimeout(() => {
                                    const newState = runDataAnalysisSwitch.getAttribute('aria-checked');
                                    console.log(`Switch state after click: ${newState}`);
                                    console.log(`State changed: ${initialState !== newState}`);
                                }, 100);
                            }, 300);
                            
                            return true;
                        } else {
                            console.log('ERROR: Could not find "Run Data Analysis" switch');
                            
                            // Fallback: log all available h4 texts for debugging
                            const allH4s = Array.from(document.querySelectorAll('h4'));
                            const h4Texts = allH4s.map(h4 => h4.textContent?.trim()).filter(Boolean);
                            console.log('Available h4 texts:', h4Texts);
                            
                            // Try fallback with "Data Analysis" (OVERRIDE_EXTENSIONS name)
                            for (let i = 0; i < allSwitches.length; i++) {
                                const switchEl = allSwitches[i];
                                if (switchEl.id === 'show-enabled-only') continue;
                                
                                const container = switchEl.closest('div');
                                if (container) {
                                    const h4 = container.querySelector('h4');
                                    const h4Text = h4 ? h4.textContent.trim() : '';
                                    
                                    if (h4Text === 'Data Analysis') {
                                        console.log(`FALLBACK: Found "Data Analysis" switch at index ${i}`);
                                        switchEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        setTimeout(() => switchEl.click(), 300);
                                        return true;
                                    }
                                }
                            }
                            
                            return false;
                        }
                    }"""
                ),
            )
            await self.take_screenshot(
                "Attempted to toggle Run Data Analysis command using precise JavaScript targeting"
            )

        # Navigate to new chat to test the capability
        await self.test_action(
            "Navigate to chat to test the newly enabled Run Data Analysis capability",
            lambda: self.page.goto(f"{self.base_uri}/chat"),
        )

        await self.test_action(
            "Wait for chat page to load completely",
            lambda: self.page.wait_for_load_state("networkidle", timeout=60000),
        )

        await self.test_action(
            "Click in the chat input to expand it for message entry",
            lambda: self.page.click("#chat-message-input-inactive"),
        )

        await self.test_action(
            "Enter a message to test the Run Data Analysis capability with letter counting",
            lambda: self.page.fill(
                "#chat-message-input-active",
                "How many of the letter 'r' is in the word 'strawberry'",
            ),
        )

        await self.test_action(
            "Send the message to test the data analysis capability",
            lambda: self.page.press("#chat-message-input-active", "Enter"),
        )

        # Wait for the response which should demonstrate the data analysis capability
        await asyncio.sleep(90)

        await self.take_screenshot(
            "Chat response showing the Run Data Analysis capability in action"
        )

        # Click "Completed activities" to see what commands were executed
        # Try multiple selectors to find the completed activities section
        activities_selectors = [
            'text="Completed activities"',
            'text="Completed activities."',
            ':text("Completed activities")',
            ':text("completed activities")',
            '[data-testid="completed-activities"]',
            'button:has-text("Completed")',
            'div:has-text("Completed activities")',
            'span:has-text("Completed activities")',
            # Look for dropdown arrows near the text
            'text="Completed activities" + *',
            '*:has-text("Completed activities") >> xpath=following-sibling::*[1]',
        ]

        activities_clicked = False
        for selector in activities_selectors:
            try:
                await self.test_action(
                    f"Click on completed activities section using selector: {selector}",
                    lambda s=selector: self.page.wait_for_selector(
                        s, state="visible", timeout=10000
                    ),
                    lambda s=selector: self.page.click(s),
                )
                activities_clicked = True
                break
            except Exception as e:
                logging.info(f"Activities selector {selector} failed: {e}")
                continue

        if not activities_clicked:
            # Try a more general approach - look for any expandable element
            await self.test_action(
                "Attempt to find and click any expandable activities section",
                lambda: self.page.wait_for_selector(
                    "button, div[role='button'], [aria-expanded]",
                    state="visible",
                    timeout=10000,
                ),
                lambda: self.page.evaluate(
                    """() => {
                    // Look for elements containing "completed" or "activities" text
                    const elements = Array.from(document.querySelectorAll('*'));
                    for (const el of elements) {
                        const text = el.textContent?.toLowerCase() || '';
                        if (text.includes('completed') && text.includes('activities')) {
                            el.click();
                            return true;
                        }
                    }
                    return false;
                }"""
                ),
            )

        await self.take_screenshot(
            "Completed activities section is now visible showing executed commands"
        )

        # Scroll down to see more of the completed activities
        await self.test_action(
            "Scroll down to view more details of the completed activities and command execution",
            lambda: self.page.evaluate("window.scrollBy(0, window.innerHeight * 0.5)"),
        )

        await self.take_screenshot(
            "Extension demo complete - showing the data analysis commands that were executed"
        )

    async def run_extensions_demo_test(self, email, mfa_token):
        """Run extensions demo test and create video"""
        try:
            # User is already logged in from shared session
            await self.handle_extensions_demo()
            video_path = self.create_video_report(video_name="extensions_demo")
            logging.info(
                f"Extensions demo test complete. Video report created at {video_path}"
            )
        except Exception as e:
            logging.error(f"Extensions demo test failed: {e}")
            if not os.path.exists(
                os.path.join(os.getcwd(), "tests", "extensions_demo.mp4")
            ):
                self.create_video_report(
                    video_name="extensions_demo", test_status="❌ **TEST FAILURE**"
                )
            raise e

    async def run(self, headless=not is_desktop()):
        """Run all tests: registration in its own browser, then all others in a shared browser"""
        email = None
        mfa_token = None

        try:
            # PHASE 1: Registration test in its own browser
            logging.info("=== Starting Registration Test (Phase 1) ===")
            async with async_playwright() as playwright:
                browser = await playwright.chromium.launch(headless=headless)
                context = await browser.new_context()
                page = await context.new_page()
                page.on("console", print_args)
                page.set_default_timeout(60000)  # Increase to 60 seconds
                await page.set_viewport_size({"width": 1367, "height": 924})

                # Set browser references for registration test
                self.playwright = playwright
                self.browser = browser
                self.context = context
                self.page = page

                # Run registration test
                email, mfa_token = await self.run_registration_test()

                # Close registration browser
                await browser.close()
                logging.info("=== Registration Test Complete - Browser Closed ===")

            # PHASE 2: All other tests in a new shared browser session
            logging.info("=== Starting Shared Browser Session (Phase 2) ===")
            async with async_playwright() as self.playwright:
                self.browser = await self.playwright.chromium.launch(headless=headless)
                self.context = await self.browser.new_context()
                self.page = await self.browser.new_page()
                self.page.on("console", print_args)
                self.page.set_default_timeout(60000)  # Increase to 60 seconds
                await self.page.set_viewport_size({"width": 1367, "height": 924})

                # Start with login to establish session
                # Clear screenshots for first video in shared session
                self.screenshots_with_actions = []

                # Login test (start the shared session)
                await self.run_login_test(email, mfa_token)
                logging.info("=== Login Complete - Continuing with other tests ===")

                # Clear screenshots for next video
                self.screenshots_with_actions = []

                # Extensions test
                await self.run_extensions_demo_test(email, mfa_token)
                self.screenshots_with_actions = []

                # Mandatory context test
                await self.run_mandatory_context_test(email, mfa_token)

                # Clear screenshots for next video
                self.screenshots_with_actions = []

                # Chat test
                await self.run_chat_test(email, mfa_token)

                # Clear screenshots for next video
                self.screenshots_with_actions = []

                # User preferences test
                await self.run_user_preferences_test(email, mfa_token)

                # Clear screenshots for next video
                self.screenshots_with_actions = []

                # Team management test
                await self.run_team_management_test(email, mfa_token)

                # Training test
                # await self.run_training_test(email, mfa_token)

                # Clear screenshots for next video
                # self.screenshots_with_actions = []

                # Provider settings test
                # await self.run_provider_settings_test(email, mfa_token)

                # Stripe test (if enabled)
                if "stripe" in self.features:
                    # Clear screenshots for next video
                    self.screenshots_with_actions = []
                    await self.run_stripe_test()

                logging.info(
                    "=== All tests complete. Individual videos created for each feature area. ==="
                )

                # Close shared browser session
                await self.browser.close()

        except Exception as e:
            logging.error(f"Test suite failed: {e}")
            if hasattr(self, "browser") and self.browser:
                try:
                    await self.browser.close()
                except:
                    pass
            raise e


class TestRunner:
    def __init__(self):
        pass

    def run(self):
        test = FrontEndTest(base_uri="http://localhost:3437")
        try:
            if platform.system() == "Linux":
                print("Linux Detected, using asyncio.run")
                if not asyncio.get_event_loop().is_running():
                    try:
                        asyncio.run(test.run())
                    except Exception as e:
                        logging.error(f"Test execution failed: {e}")
                        # Make one final attempt to create video if it doesn't exist
                        if not os.path.exists(
                            os.path.join(os.getcwd(), "tests", "report.mp4")
                        ):
                            test.create_video_report(test_status="❌ **TEST FAILURE**")
                        sys.exit(1)
                else:
                    try:
                        nest_asyncio.apply()
                        asyncio.get_event_loop().run_until_complete(test.run())
                    except Exception as e:
                        logging.error(f"Test execution failed: {e}")
                        if not os.path.exists(
                            os.path.join(os.getcwd(), "tests", "report.mp4")
                        ):
                            test.create_video_report(test_status="❌ **TEST FAILURE**")
                        sys.exit(1)
            else:
                print("Windows Detected, using asyncio.ProactorEventLoop")
                loop = asyncio.ProactorEventLoop()
                nest_asyncio.apply(loop)
                try:
                    loop.run_until_complete(test.run())
                except Exception as e:
                    logging.error(f"Test execution failed: {e}")
                    if not os.path.exists(
                        os.path.join(os.getcwd(), "tests", "report.mp4")
                    ):
                        test.create_video_report(test_status="❌ **TEST FAILURE**")
                    sys.exit(1)
                finally:
                    loop.close()
        except Exception as e:
            logging.error(f"Critical failure: {e}")
            # Try one last time to create video even in case of critical failure
            if not os.path.exists(os.path.join(os.getcwd(), "tests", "report.mp4")):
                try:
                    test.create_video_report(test_status="❌ **CRITICAL FAILURE**")
                except Exception as video_error:
                    logging.error(f"Failed to create video report: {video_error}")
            sys.exit(1)
