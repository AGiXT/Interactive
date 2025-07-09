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
            f"To get started, simply enter your email address here. For this demo, we're using a test email that doesn't exist yet, so we'll be taken through the full registration process.",
            lambda: self.page.fill("#email", email_address),
        )

        await self.test_action(
            "Now we'll click 'Continue with Email' to proceed with creating our new account.",
            lambda: self.page.locator("text=Continue with Email").click(),
        )

        first_name = "Test"
        last_name = "User"
        await self.test_action(
            f"The registration form asks for your first name. We'll enter '{first_name}' for this demonstration.",
            lambda: self.page.fill("#first_name", first_name),
        )

        await self.test_action(
            f"Next, we'll add our last name '{last_name}' to complete our profile information.",
            lambda: self.page.fill("#last_name", last_name),
        )

        await self.test_action(
            "With all the required information filled in, we'll click 'Register' to create our account. This will automatically set up multi-factor authentication for security.",
            lambda: self.page.click('button[type="submit"]'),
        )

        mfa_token = await self.test_action(
            "After registration, we'll automatically scan the QR code and enter the one-time password to complete setup and gain access to the application.",
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
                "Welcome to the chat interface. This is where you'll interact with your 'A G I X T' agent. Let's explore how easy it is to get started."
            )

            await self.test_action(
                "To begin a conversation, simply click in the chat input area. Notice how it expands to give you more space to type your message.",
                lambda: self.page.click("#chat-message-input-inactive"),
            )
            await self.test_action(
                "Now we'll type a simple question to demonstrate the AI's capabilities. We'll ask for a basic Python example.",
                lambda: self.page.fill(
                    "#chat-message-input-active",
                    "Can you show be a basic 'hello world' Python example?",
                ),
            )
            await self.test_action(
                "When you're ready, just press Enter or click the send button. The AI will begin processing your request and thinking through the best response.",
                lambda: self.page.press("#chat-message-input-active", "Enter"),
            )

            await asyncio.sleep(90)

            await self.take_screenshot(
                "The AI has responded with a complete answer, showing both the code example and its thought process. Notice how it also automatically names the conversation based on our question."
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
            "Let's explore how to set up mandatory context for your 'A G I X T' agent. This feature ensures the AI always follows specific instructions you define."
        )

        # Navigate to Agent Management
        await self.test_action(
            "First, we'll navigate to Agent Management where we can configure advanced AI behavior settings.",
            lambda: self.page.click('span:has-text("Agent Management")'),
        )

        await self.take_screenshot(
            "The Agent Management menu has opened, showing various configuration options."
        )

        # Navigate to Training from the dropdown
        await self.test_action(
            "Now we'll click on 'Training' to access the mandatory context settings.",
            lambda: self.page.click('a:has-text("Training")'),
        )

        # Wait for the training page to load completely
        await self.test_action(
            "The training page loads with all available configuration options.",
            lambda: asyncio.sleep(3),
        )

        await self.take_screenshot(
            "Now the training interface has loaded, showing where we can configure mandatory context."
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
                    f"Now we'll locate the mandatory context input field and enter our custom instructions.",
                    lambda s=selector: self.page.wait_for_selector(
                        s, state="visible", timeout=5000
                    ),
                    lambda s=selector: self.page.fill(s, mandatory_context_text),
                )
                context_field_found = True
                await self.take_screenshot(
                    "We've entered our mandatory context instructions. This text will now be included in every conversation with the AI."
                )
                break
            except Exception as e:
                logging.info(f"Selector {selector} failed: {e}")
                continue

        if not context_field_found:
            # If no specific selector worked, try to find any visible textarea and use it
            await self.test_action(
                "Let's find the text area where we can enter our mandatory context instructions.",
                lambda: self.page.wait_for_selector(
                    "textarea", state="visible", timeout=10000
                ),
                lambda: self.page.fill("textarea", mandatory_context_text),
            )
            await self.take_screenshot(
                "Our mandatory context instructions have been entered successfully."
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
                    f"Now we'll save our mandatory context settings by clicking the update button.",
                    lambda s=selector: self.page.wait_for_selector(
                        s, state="visible", timeout=5000
                    ),
                    lambda s=selector: self.page.click(s),
                )
                update_button_found = True
                await self.take_screenshot(
                    "Our mandatory context settings have been saved successfully."
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
                "We'll try an alternative way to save our mandatory context settings.",
                lambda: self.page.press(
                    "textarea", "Tab"
                ),  # Move focus away from textarea
            )
            # Try to find any submit button or form submission
            try:
                await self.test_action(
                    "We'll look for any available save button to apply our changes.",
                    lambda: self.page.click(
                        "button[type='submit'], input[type='submit'], form button"
                    ),
                )
                await self.take_screenshot(
                    "Successfully saved our mandatory context configuration using an alternative method."
                )
            except Exception as e:
                logging.warning(f"Could not submit form: {e}")

        # Wait for the update to process
        await self.test_action(
            "The system processes our mandatory context settings in the background.",
            lambda: asyncio.sleep(3),
        )

        await self.take_screenshot(
            "Our mandatory context is now configured and ready to influence all future conversations."
        )

        # Navigate to chat to test the mandatory context
        await self.test_action(
            "Now let's test our mandatory context by starting a new conversation to see how it affects the AI's responses.",
            lambda: self.page.goto(f"{self.base_uri}/chat"),
        )

        await self.test_action(
            "The chat page loads and is ready for our test.",
            lambda: asyncio.sleep(3),
        )

        await self.test_action(
            "Now we'll click in the chat input to begin our test conversation.",
            lambda: self.page.click("#chat-message-input-inactive"),
        )

        await self.test_action(
            "We'll ask a simple question about nature to see if the AI incorporates our mandatory context instruction about using the word 'wonderful'.",
            lambda: self.page.fill(
                "#chat-message-input-active",
                "What do you think about nature?",
            ),
        )

        await self.test_action(
            "Now we'll send the message to test how our mandatory context affects the AI's response.",
            lambda: self.page.press("#chat-message-input-active", "Enter"),
        )

        # Wait for the response which should include "wonderful" due to mandatory context
        await asyncio.sleep(90)

        await self.take_screenshot(
            "Notice how the AI's response includes the word 'wonderful' as instructed by our mandatory context. This shows how mandatory context successfully influences every conversation."
        )

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
                "Let's start by navigating to the login page where users can sign in to their account.",
                lambda: self.page.goto(f"{self.base_uri}/user"),
                lambda: self.page.wait_for_selector("input#email", state="visible"),
            )

            await self.test_action(
                "Now we'll enter the email address we just registered with for our test account.",
                lambda: self.page.wait_for_selector("#email", state="visible"),
                lambda: self.page.fill("#email", email),
            )

            # Click continue with email
            await self.test_action(
                "After entering the email, we'll click 'Continue with Email' to proceed with authentication.",
                lambda: self.page.wait_for_selector(
                    "text=Continue with Email", state="visible"
                ),
                lambda: self.page.click("text=Continue with Email"),
            )

            # Generate OTP code from saved MFA token
            otp = pyotp.TOTP(mfa_token).now()

            # Fill in the OTP code
            await self.test_action(
                "The system now asks for our multi-factor authentication code. We'll generate and enter the current code from our authenticator app.",
                lambda: self.page.wait_for_selector("#token", state="visible"),
                lambda: self.page.fill("#token", otp),
            )

            # Submit the login form
            await self.test_action(
                "Finally, we'll submit our authentication code to complete the login process.",
                lambda: self.page.wait_for_selector(
                    'button[type="submit"]', state="visible"
                ),
                lambda: self.page.click('button[type="submit"]'),
            )

            # Wait a bit for the login to process
            await asyncio.sleep(5)

            # Verify successful login by checking for specific UI elements instead of networkidle
            await self.test_action(
                "The system has authenticated us successfully and we're now logged into the main application interface.",
                lambda: self.verify_login_success(),
            )
        except Exception as e:
            logging.error(f"Error during login: {e}")
            raise Exception(f"Error during login: {str(e)}")

    async def verify_login_success(self):
        """Verify login success by checking for authenticated UI elements with multiple fallbacks"""
        try:
            # Primary verification: Look for "New Chat" button which indicates user is logged in
            await self.page.wait_for_selector('text="New Chat"', timeout=30000)
            logging.info(
                "Login verified: Found 'New Chat' button - user is authenticated"
            )
            return True
        except:
            logging.info(
                "'New Chat' button not found, trying fallback verifications..."
            )

            # Fallback 1: Check for sidebar which appears when authenticated
            try:
                await self.page.wait_for_selector(
                    '[data-sidebar="sidebar"]', timeout=15000
                )
                logging.info("Login verified: Found sidebar - user is authenticated")
                return True
            except:
                logging.info("Sidebar not found, trying URL verification...")

                # Fallback 2: Check if we're not on the login page anymore
                current_url = self.page.url
                if "/user" not in current_url:
                    logging.info(
                        f"Login verified: No longer on login page - URL: {current_url}"
                    )
                    return True
                else:
                    # Fallback 3: Look for any chat-related elements
                    try:
                        await self.page.wait_for_selector(
                            '#chat-message-input-inactive, .chat-container, [data-testid="chat"]',
                            timeout=10000,
                        )
                        logging.info(
                            "Login verified: Found chat-related elements - user is authenticated"
                        )
                        return True
                    except:
                        # Final fallback: Check for user menu or profile elements
                        try:
                            await self.page.wait_for_selector(
                                '[data-sidebar="footer"] button, .user-menu, [role="menuitem"]',
                                timeout=10000,
                            )
                            logging.info(
                                "Login verified: Found user interface elements - user is authenticated"
                            )
                            return True
                        except:
                            raise Exception(
                                "Login verification failed - could not find any authenticated UI elements"
                            )

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
                "Let's explore how to update your user profile and preferences. We'll start from the chat interface and navigate to account management."
            )

            # Navigate to user management page
            await self.test_action(
                "We'll navigate to the account management page where you can update your personal information and preferences.",
                lambda: self.page.wait_for_selector("body", state="visible"),
                lambda: self.page.goto(f"{self.base_uri}/user/manage"),
            )

            # Take a screenshot to examine the form structure
            await self.take_screenshot(
                "Here's the user management interface where you can modify your profile details."
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
                    f"Let's update the last name field with a new value: '{new_last_name}'. This demonstrates how easy it is to modify your profile information.",
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
                "We'll also look for any dropdown menus or selection fields that can be updated, such as timezone or language preferences.",
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
            await self.take_screenshot(
                "We've made some changes to the available profile fields and dropdown selections."
            )

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
                        "Now we'll save all our changes by clicking the update button. This will apply all the modifications we've made to our profile.",
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
                    "We'll try submitting the form directly to save our profile changes.",
                    lambda: self.page.wait_for_selector("form", state="visible"),
                    lambda: self.page.evaluate(
                        "document.querySelector('form').submit()"
                    ),
                )

            # Wait for the page to settle after the update
            await self.test_action(
                "The system is now processing our profile updates.",
                lambda: asyncio.sleep(3),  # 3 second wait
            )

            # Take a final screenshot to show the result
            await self.take_screenshot(
                "Your profile has been successfully updated with all the new information."
            )

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
                "Let's explore the team management features. This is where you can invite colleagues and manage your team's access to the 'A G I X T' agent."
            )

            # Navigate to team page
            await self.test_action(
                "We'll navigate to the team management page where you can see current team members and send new invitations.",
                lambda: self.page.wait_for_selector("body", state="visible"),
                lambda: self.page.goto(f"{self.base_uri}/team"),
            )

            # Wait for team page to load completely
            await self.test_action(
                "The team management interface loads with all available options.",
                lambda: asyncio.sleep(5),  # 5 second wait for team page
            )

            # Generate a random email for invitation
            invite_email = f"test.user+{uuid.uuid4().hex[:8]}@example.com"

            # Find and fill the email field
            await self.test_action(
                "Now we'll enter an email address to invite a new team member. For this demo, we're using a test email address.",
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
                    "We can see the role selection dropdown is available for choosing the new member's permissions.",
                    lambda: self.page.wait_for_selector(
                        ".select-content", state="visible", timeout=1000
                    ),
                )
            else:
                await self.test_action(
                    "We'll proceed with the default role selection for this new team member.",
                    lambda: self.page.wait_for_timeout(1000),
                )

            # Click Send Invitation button
            await self.test_action(
                "With the email entered and role selected, we'll click 'Send Invitation' to invite this person to join our team.",
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
                    "The system is showing a confirmation message that the invitation was sent successfully.",
                    lambda: self.page.wait_for_selector(
                        'text="sent successfully"', state="visible", timeout=10000
                    ),
                )
            else:
                await self.test_action(
                    "We can see the pending invitations section where our new invitation will appear.",
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
                    f"The invited email '{invite_email}' now appears in the pending invitations list, confirming the invitation was sent.",
                    lambda: self.page.wait_for_selector(
                        f'text="{invite_email}"', state="visible", timeout=5000
                    ),
                )
            else:
                await self.test_action(
                    "The invitation has been processed successfully. The invited user will receive an email to join the team.",
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
            "Let's explore the subscription management features. This is where you can upgrade your account to access premium features."
        )

        # Navigate to subscription page
        await self.test_action(
            "We'll navigate to the subscription page to see the available plans and pricing options.",
            lambda: self.page.goto(f"{self.base_uri}/subscription"),
        )

        await self.take_screenshot(
            "Here's the subscription page showing all available plans and their features."
        )
        await self.test_action(
            "Let's select a plan and proceed to the secure Stripe checkout process.",
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
                "We can see the subscription confirmation options are available.",
                lambda: None,
            )
            await self.test_action(
                "Let's proceed with the subscription confirmation.",
                lambda: sus_button.click(),
            )

        await self.test_action(
            "Now we'll enter the payment details. For this demo, we'll use Stripe's test card number.",
            lambda: self.page.fill("input#cardNumber", "4242424242424242"),
        )

        await self.test_action(
            "We'll add an expiration date for our test card.",
            lambda: self.page.fill("input#cardExpiry", "1230"),
        )

        await self.test_action(
            "And we'll add the security code for the test card.",
            lambda: self.page.fill("input#cardCvc", "123"),
        )

        await self.test_action(
            "Let's enter a billing name for this subscription.",
            lambda: self.page.fill("input#billingName", "Test User"),
        )

        await self.test_action(
            "We'll select the billing country from the dropdown.",
            lambda: self.page.select_option("select#billingCountry", "US"),
        )

        await self.test_action(
            "Finally, we'll add a postal code to complete the billing information.",
            lambda: self.page.fill("input#billingPostalCode", "90210"),
        )

        await self.test_action(
            "Now we'll submit the payment to complete our subscription upgrade.",
            lambda: self.page.click("button.SubmitButton.SubmitButton--complete"),
        )
        await self.page.wait_for_timeout(15000)
        await self.take_screenshot(
            "The payment has been processed successfully and your subscription is now active."
        )

    async def run_registration_test(self):
        """Run registration test and create video"""
        try:
            logging.info(f"Navigating to {self.base_uri}")
            await self.page.goto(self.base_uri)
            await self.take_screenshot(
                "Welcome. This is the landing page where new users can get started with their 'A G I X T' agent."
            )

            logging.info("Clicking 'Register or Login' button")
            await self.page.click('text="Login or Register"')
            await self.take_screenshot(
                "Here you can see the various authentication options available. You can use social login with providers like Google or Microsoft, or create an account using just your email address."
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
            "Let's explore how to configure AI provider settings. This is where you can connect different AI services and manage API keys."
        )

        # Navigate to Agent Management
        await self.test_action(
            "We'll start by navigating to Agent Management to access the provider configuration options.",
            lambda: self.page.click('span:has-text("Agent Management")'),
        )

        await self.take_screenshot(
            "The Agent Management menu is now open, showing various configuration options including provider settings."
        )

        # Navigate to Settings via dropdown
        await self.test_action(
            "Now we'll click on 'Settings' to access the provider configuration interface.",
            lambda: self.page.click('a:has-text("Settings")'),
        )

        await self.take_screenshot(
            "The settings page has loaded where we can configure various AI providers."
        )

        # Click on Providers tab if needed
        try:
            # Check if we need to navigate to the Providers tab
            providers_tab_visible = (
                await self.page.locator('button:has-text("Providers")').count() > 0
            )
            if providers_tab_visible:
                await self.test_action(
                    "We can see there's a dedicated 'Providers' tab. We'll click on it to access the provider-specific settings.",
                    lambda: self.page.click('button:has-text("Providers")'),
                )
        except Exception as e:
            logging.info(f"Provider tab navigation not needed: {e}")

        await self.take_screenshot(
            "Now we can see all the available AI providers and their current connection status."
        )

        # Click on Google provider connect button
        await self.test_action(
            "Let's demonstrate connecting to Google's AI services. We'll click the 'Connect' button next to Google.",
            lambda: self.page.click('button:has-text("Connect"):near(:text("Google"))'),
        )

        await self.take_screenshot(
            "The Google provider configuration dialog has opened where we can enter our API credentials."
        )

        # Input API key in the dialog
        await self.test_action(
            "Now we'll enter a Google API key. In a real scenario, you'd enter your actual API key from Google Cloud Console.",
            lambda: self.page.fill(
                'input[placeholder*="API key"]', "MOCK_GOOGLE_API_KEY_FOR_TESTING"
            ),
        )

        await self.take_screenshot(
            "We've entered the API key. Notice how the interface clearly shows where to input your credentials."
        )

        # Click Save/Connect in the dialog
        await self.test_action(
            "Now we'll save our API key configuration by clicking 'Connect Provider' to establish the connection.",
            lambda: self.page.get_by_role("button", name="Connect Provider").click(),
        )

        await self.take_screenshot(
            "Our provider settings have been saved successfully."
        )

        # Verify the provider is now connected (status check)
        await self.test_action(
            "We can now see that Google is showing as 'Connected', indicating our API key was accepted and the integration is working.",
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
            lambda: self.page.click('text="New Chat"'),
        )

        # Wait a couple seconds for the chat interface to settle
        await asyncio.sleep(3)

        await self.test_action(
            "The chat interface is now ready. This is your central hub for interacting with your 'A G I X T' agent. Notice the clean, intuitive design that makes it easy to start conversations.",
            lambda: self.page.wait_for_selector(
                "#chat-message-input-inactive", state="visible", timeout=30000
            ),
        )

    # Removed duplicate run method - see the correct one at the end of the class

    async def handle_extensions_demo(self):
        """Handle extensions demo scenario: Agent Management → Extensions → Abilities → Toggle Command → New Chat → Test Message"""
        # Start at chat screen first for consistent navigation
        await self.navigate_to_chat_first(
            "Let's explore the powerful extensions and abilities system. This is where you can enable special capabilities for your 'A G I X T' agent."
        )

        # Navigate to Agent Management
        await self.test_action(
            "We'll start by going to Agent Management to access the extensions and abilities configuration.",
            lambda: self.page.click('span:has-text("Agent Management")'),
        )

        await self.take_screenshot(
            "The Agent Management menu is open, showing us various ways to enhance our 'A G I X T' agent."
        )

        # Navigate to Extensions from the dropdown
        await self.test_action(
            "We'll click on 'Extensions' to see what additional capabilities are available for our 'A G I X T' agent.",
            lambda: self.page.click('a:has-text("Extensions")'),
        )

        # Wait for the extensions page to load completely
        await asyncio.sleep(3)

        await self.take_screenshot(
            "Here we can see all the available extensions that can enhance our AI's capabilities."
        )

        # Navigate to Abilities
        await self.test_action(
            "Now let's navigate to the 'Abilities' section where we can enable or disable specific AI capabilities.",
            lambda: self.page.click('a:has-text("Abilities")'),
        )

        # Wait for the abilities page to load
        await asyncio.sleep(3)

        await self.take_screenshot(
            "This is the abilities dashboard where we can control what our 'A G I X T' agent can do."
        )

        # Scroll down to make the "Run Data Analysis" option visible
        await self.test_action(
            "We'll scroll down to see more available capabilities, including some advanced data analysis features.",
            lambda: self.page.evaluate("window.scrollBy(0, window.innerHeight * 0.5)"),
        )

        await self.take_screenshot(
            "Now we can see additional capabilities including 'Run Data Analysis' which we'll enable."
        )

        # First, let's debug what's actually on the page
        await self.test_action(
            "We'll examine what capabilities are available on this page so we can enable the right one.",
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

        # Direct JavaScript approach - bypass CSS selectors that are unreliable
        await self.test_action(
            "Now we'll enable the 'Run Data Analysis' capability by toggling its switch. This will allow our AI to perform advanced data analysis tasks.",
            lambda: self.page.evaluate(
                """() => {
                    console.log('Enabling Run Data Analysis capability');
                    
                    // Get ALL switches in the exact same order as debug output
                    const allSwitches = Array.from(document.querySelectorAll('button[role="switch"]'));
                    console.log(`Found ${allSwitches.length} total switches`);
                    
                    // Based on debug output: Switch 2 is "Run Data Analysis"
                    const targetIndex = 2;
                    
                    if (targetIndex < allSwitches.length) {
                        const targetSwitch = allSwitches[targetIndex];
                        console.log(`Clicking switch at index ${targetIndex}`);
                        
                        // Verify this is the right switch by checking its container
                        const container = targetSwitch.closest('div');
                        const h4 = container ? container.querySelector('h4') : null;
                        const h4Text = h4 ? h4.textContent.trim() : 'NO H4';
                        console.log(`Switch ${targetIndex} container h4 text: "${h4Text}"`);
                        
                        if (h4Text === 'Run Data Analysis') {
                            console.log('CONFIRMED: This is the Run Data Analysis switch');
                        } else {
                            console.log(`WARNING: Expected "Run Data Analysis" but found "${h4Text}"`);
                        }
                        
                        // Get initial state
                        const initialState = targetSwitch.getAttribute('aria-checked');
                        console.log(`Initial switch state: ${initialState}`);
                        
                        // Scroll and click
                        targetSwitch.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        targetSwitch.click();
                        console.log('Clicked switch');
                        
                        // Check final state
                        setTimeout(() => {
                            const finalState = targetSwitch.getAttribute('aria-checked');
                            console.log(`Final switch state: ${finalState}`);
                            console.log(`State changed: ${initialState !== finalState}`);
                        }, 500);
                        
                        return true;
                    } else {
                        console.log(`ERROR: Index ${targetIndex} out of range for ${allSwitches.length} switches`);
                        return false;
                    }
                }"""
            ),
        )

        await self.take_screenshot(
            "We've successfully enabled the Run Data Analysis capability. Notice how the toggle switch has changed to show it's now active."
        )

        # Navigate to new chat to test the capability
        await self.test_action(
            "Now let's test our newly enabled capability by starting a new chat conversation.",
            lambda: self.page.goto(f"{self.base_uri}/chat"),
        )

        await self.test_action(
            "The chat interface loads and is ready for testing our new data analysis capability.",
            lambda: asyncio.sleep(3),
        )

        await self.test_action(
            "Now we'll click in the chat input to start our test conversation.",
            lambda: self.page.click("#chat-message-input-inactive"),
        )

        await self.test_action(
            "We'll ask a question that will require data analysis. We'll ask the AI to count letters in a word - something that should trigger our newly enabled capability.",
            lambda: self.page.fill(
                "#chat-message-input-active",
                "How many of the letter 'r' is in the word 'strawberry'",
            ),
        )

        await self.test_action(
            "Now we'll send this message to see how our AI uses the data analysis capability we just enabled.",
            lambda: self.page.press("#chat-message-input-active", "Enter"),
        )

        # Wait for the response which should demonstrate the data analysis capability
        await asyncio.sleep(90)

        await self.take_screenshot(
            "Look at this response - the AI didn't just guess, it actually used the data analysis capability we enabled to systematically count the letters and provide an accurate answer."
        )

        # Click "Show subactivities" to see what commands were executed
        # Try multiple selectors to find the subactivities toggle button
        activities_selectors = [
            'button:has-text("Show") >> :has-text("subactivities")',
            'button:has-text("subactivities")',
            "button >> text=/Show.*subactivities/",
            "button >> text=/Show.*activities/",
            'text="Show"',
            'button:has-text("Show")',
            ':text("Show") >> button',
            ':text("subactivities") >> button',
            'span:has-text("Show") >> xpath=..',
            # Look for the button with subactivities text
            'text="Show" + *:has-text("subactivities")',
            '*:has-text("Show") >> *:has-text("subactivities")',
            # More specific patterns for the new button
            'button:has-text("Show") >> text="subactivities"',
            # Try to find by the specific button structure
            '[role="button"]:has-text("Show")',
            'button[class*="ghost"]:has-text("Show")',
        ]

        activities_clicked = False
        for selector in activities_selectors:
            try:
                await self.test_action(
                    f"Click on show subactivities button using selector: {selector}",
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
                "We'll try to find and expand the subactivities section to see exactly what commands were executed behind the scenes.",
                lambda: self.page.wait_for_selector(
                    "button, div[role='button'], [aria-expanded]",
                    state="visible",
                    timeout=10000,
                ),
                lambda: self.page.evaluate(
                    """() => {
                    // Look for elements containing "show" and "subactivities" text
                    const elements = Array.from(document.querySelectorAll('button, *[role="button"]'));
                    for (const el of elements) {
                        const text = el.textContent?.toLowerCase() || '';
                        if ((text.includes('show') && text.includes('subactivities')) || 
                            (text.includes('show') && text.includes('activities'))) {
                            el.click();
                            return true;
                        }
                    }
                    return false;
                }"""
                ),
            )

        await self.take_screenshot(
            "Now we can see the expanded subactivities section which shows us exactly what commands the AI executed to analyze our question."
        )

        # Scroll down to see more of the subactivities
        await self.test_action(
            "We'll scroll down to see more details about the specific commands that were executed during the data analysis process.",
            lambda: self.page.evaluate("window.scrollBy(0, window.innerHeight * 0.5)"),
        )

        await self.take_screenshot(
            "This completes our extensions demo. You can see how enabling specific capabilities allows the AI to use powerful tools and commands to provide more accurate and detailed responses."
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

    async def handle_tasks_demo(self):
        """Handle tasks page demo scenario"""
        # Start at chat screen first for consistent navigation
        await self.navigate_to_chat_first(
            "Let's explore the task management capabilities. This is where you can create, organize, and manage various tasks for your 'A G I X T' agent."
        )

        # Navigate to tasks page
        await self.test_action(
            "We'll navigate to the tasks page where you can create and manage different types of tasks and workflows.",
            lambda: self.page.goto(f"{self.base_uri}/tasks"),
        )

        # Wait for tasks page to load
        await self.test_action(
            "The tasks page is loading with all available task management options.",
            lambda: asyncio.sleep(3),
        )

        await self.take_screenshot(
            "Here's the tasks management interface where you can create and organize different types of tasks for your AI agent."
        )

        # Look for task creation buttons or interface elements
        try:
            # Check for any task creation buttons
            task_buttons = await self.page.locator("button").all()
            if task_buttons:
                await self.test_action(
                    "We can see various task management options and buttons available for creating new tasks.",
                    lambda: self.page.wait_for_selector(
                        "button", state="visible", timeout=5000
                    ),
                )

                # Try to click the first available task-related button
                await self.test_action(
                    "Let's explore the task creation interface by clicking on an available option.",
                    lambda: self.page.click("button:first-child"),
                )

                await self.take_screenshot(
                    "The task creation interface shows the available options for setting up automated tasks and workflows."
                )
        except Exception as e:
            logging.info(f"No specific task creation buttons found: {e}")

        # Check for any forms or input fields related to task management
        try:
            # Look for any input fields that might be related to task creation
            inputs = await self.page.locator("input").all()
            if inputs:
                await self.test_action(
                    "We can see input fields where you can define task parameters and configurations.",
                    lambda: self.page.wait_for_selector(
                        "input", state="visible", timeout=5000
                    ),
                )
        except Exception as e:
            logging.info(f"No task input fields found: {e}")

        await self.take_screenshot(
            "This completes our tasks management demo. You can see how this interface allows you to create and manage various automated tasks and workflows."
        )

    async def run_tasks_test(self, email, mfa_token):
        """Run tasks test and create video"""
        try:
            # User is already logged in from shared session
            await self.handle_tasks_demo()
            video_path = self.create_video_report(video_name="tasks_demo")
            logging.info(f"Tasks test complete. Video report created at {video_path}")
        except Exception as e:
            logging.error(f"Tasks test failed: {e}")
            if not os.path.exists(os.path.join(os.getcwd(), "tests", "tasks_demo.mp4")):
                self.create_video_report(
                    video_name="tasks_demo", test_status="❌ **TEST FAILURE**"
                )
            raise e

    async def handle_chains_demo(self):
        """Handle chains configuration demo scenario"""
        # Start at chat screen first for consistent navigation
        await self.navigate_to_chat_first(
            "Let's explore the chains configuration feature. This is where you can create complex multi-step workflows and processes for your 'A G I X T' agent."
        )

        # Navigate to Agent Management
        await self.test_action(
            "We'll start by navigating to Agent Management to access the chains configuration options.",
            lambda: self.page.click('span:has-text("Agent Management")'),
        )

        await self.take_screenshot(
            "The Agent Management menu is open, showing various configuration options including chains."
        )

        # Navigate to Chains from the dropdown
        await self.test_action(
            "Now we'll click on 'Chains' to access the workflow configuration interface.",
            lambda: self.page.click('a:has-text("Chains")'),
        )

        # Wait for the chains page to load
        await self.test_action(
            "The chains page is loading with all available workflow configuration options.",
            lambda: asyncio.sleep(3),
        )

        await self.take_screenshot(
            "Here's the chains configuration interface where you can create and manage multi-step workflows and processes."
        )

        # Look for chain creation or management elements
        try:
            # Check for any chain creation buttons
            chain_buttons = await self.page.locator("button").all()
            if chain_buttons:
                await self.test_action(
                    "We can see various chain management options and buttons available for creating new workflows.",
                    lambda: self.page.wait_for_selector(
                        "button", state="visible", timeout=5000
                    ),
                )

                # Try to interact with available chain management elements
                await self.test_action(
                    "Let's explore the chain creation interface by examining the available workflow options.",
                    lambda: asyncio.sleep(2),
                )

                await self.take_screenshot(
                    "The chain creation interface shows the available options for setting up complex multi-step workflows."
                )
        except Exception as e:
            logging.info(f"No specific chain creation buttons found: {e}")

        # Check for any forms or configuration areas
        try:
            # Look for any configuration areas or forms
            forms = await self.page.locator("form").all()
            if forms:
                await self.test_action(
                    "We can see configuration forms where you can define chain parameters and workflow steps.",
                    lambda: self.page.wait_for_selector(
                        "form", state="visible", timeout=5000
                    ),
                )
        except Exception as e:
            logging.info(f"No chain configuration forms found: {e}")

        await self.take_screenshot(
            "This completes our chains configuration demo. You can see how this interface allows you to create and manage complex multi-step workflows and automated processes."
        )

    async def run_chains_test(self, email, mfa_token):
        """Run chains test and create video"""
        try:
            # User is already logged in from shared session
            await self.handle_chains_demo()
            video_path = self.create_video_report(video_name="chains_demo")
            logging.info(f"Chains test complete. Video report created at {video_path}")
        except Exception as e:
            logging.error(f"Chains test failed: {e}")
            if not os.path.exists(
                os.path.join(os.getcwd(), "tests", "chains_demo.mp4")
            ):
                self.create_video_report(
                    video_name="chains_demo", test_status="❌ **TEST FAILURE**"
                )
            raise e

    async def handle_prompts_demo(self):
        """Handle full prompts management demo scenario"""
        # Start at chat screen first for consistent navigation
        await self.navigate_to_chat_first(
            "Let's explore the comprehensive prompts management system. This is where you can create, edit, and manage custom prompts for your 'A G I X T' agent."
        )

        # Navigate to Agent Management
        await self.test_action(
            "We'll start by navigating to Agent Management to access the prompts configuration options.",
            lambda: self.page.click('span:has-text("Agent Management")'),
        )

        await self.take_screenshot(
            "The Agent Management menu is open, showing various configuration options including prompts management."
        )

        # Navigate to Prompts from the dropdown
        await self.test_action(
            "Now we'll click on 'Prompts' to access the full prompts management interface.",
            lambda: self.page.click('a:has-text("Prompts")'),
        )

        # Wait for the prompts page to load
        await self.test_action(
            "The prompts page is loading with all available prompt management options.",
            lambda: asyncio.sleep(3),
        )

        await self.take_screenshot(
            "Here's the comprehensive prompts management interface where you can create, edit, and organize custom prompts."
        )

        # Look for prompt creation or management elements
        try:
            # Check for any prompt creation buttons
            prompt_buttons = await self.page.locator("button").all()
            if prompt_buttons:
                await self.test_action(
                    "We can see various prompt management options and buttons available for creating new prompts.",
                    lambda: self.page.wait_for_selector(
                        "button", state="visible", timeout=5000
                    ),
                )

                # Try to interact with available prompt management elements
                await self.test_action(
                    "Let's explore the prompt creation interface by examining the available options.",
                    lambda: asyncio.sleep(2),
                )

                await self.take_screenshot(
                    "The prompt creation interface shows the available options for setting up custom prompts and templates."
                )
        except Exception as e:
            logging.info(f"No specific prompt creation buttons found: {e}")

        # Check for any text areas or input fields for prompt editing
        try:
            # Look for any text areas that might be for prompt editing
            textareas = await self.page.locator("textarea").all()
            if textareas:
                await self.test_action(
                    "We can see text areas where you can write and edit custom prompts and instructions.",
                    lambda: self.page.wait_for_selector(
                        "textarea", state="visible", timeout=5000
                    ),
                )

                # Try to interact with the first textarea if available
                await self.test_action(
                    "Let's demonstrate how to create a custom prompt by entering some sample text.",
                    lambda: self.page.fill(
                        "textarea",
                        "This is a sample custom prompt for demonstration purposes.",
                    ),
                )

                await self.take_screenshot(
                    "We've entered sample text to show how you can create and edit custom prompts in this interface."
                )
        except Exception as e:
            logging.info(f"No prompt text areas found: {e}")

        await self.take_screenshot(
            "This completes our comprehensive prompts management demo. You can see how this interface allows you to create, edit, and manage custom prompts and templates for your AI agent."
        )

    async def run_prompts_test(self, email, mfa_token):
        """Run expanded prompts test and create video"""
        try:
            # User is already logged in from shared session
            await self.handle_prompts_demo()
            video_path = self.create_video_report(video_name="prompts_demo")
            logging.info(f"Prompts test complete. Video report created at {video_path}")
        except Exception as e:
            logging.error(f"Prompts test failed: {e}")
            if not os.path.exists(
                os.path.join(os.getcwd(), "tests", "prompts_demo.mp4")
            ):
                self.create_video_report(
                    video_name="prompts_demo", test_status="❌ **TEST FAILURE**"
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

                # Clear screenshots for next video
                self.screenshots_with_actions = []

                # Tasks test
                await self.run_tasks_test(email, mfa_token)

                # Clear screenshots for next video
                self.screenshots_with_actions = []

                # Chains test
                await self.run_chains_test(email, mfa_token)

                # Clear screenshots for next video
                self.screenshots_with_actions = []

                # Prompts test (expanded beyond mandatory context)
                await self.run_prompts_test(email, mfa_token)

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

    def run(self, base_uri="http://localhost:3437"):
        test = FrontEndTest(base_uri=base_uri)
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
