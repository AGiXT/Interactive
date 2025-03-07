# AGiXT Interactive

[![GitHub](https://img.shields.io/badge/GitHub-AGiXT%20Core-blue?logo=github&style=plastic)](https://github.com/Josh-XT/AGiXT) [![GitHub](https://img.shields.io/badge/GitHub-AGiXT%20Interactive%20UI-blue?logo=github&style=plastic)](https://github.com/AGiXT/AGiXT-Interactive) [![GitHub](https://img.shields.io/badge/GitHub-AGiXT%20StreamLit%20UI-blue?logo=github&style=plastic)](https://github.com/AGiXT/streamlit)

[![GitHub](https://img.shields.io/badge/GitHub-AGiXT%20TypeScript%20SDK-blue?logo=github&style=plastic)](https://github.com/AGiXT/typescript-sdk) [![npm](https://img.shields.io/badge/npm-AGiXT%20TypeScript%20SDK-blue?logo=npm&style=plastic)](https://www.npmjs.com/package/agixt)

[![Discord](https://img.shields.io/discord/1097720481970397356?label=Discord&logo=discord&logoColor=white&style=plastic&color=5865f2)](https://discord.gg/d3TkHRZcjD)
[![Twitter](https://img.shields.io/badge/Twitter-Follow_@Josh_XT-blue?logo=twitter&style=plastic)](https://twitter.com/Josh_XT)

![AGiXT_New](https://github.com/user-attachments/assets/14a5c1ae-6af8-4de8-a82e-f24ea52da23f)

AGiXT Interactive is a NextJS application allowing interaction with AGiXT agents with extensive administration options.

## Videos

Demonstration of creating a new user and setting up an AGiXT agent connected to GitHub:

https://github.com/user-attachments/assets/5dceb1b2-dfbc-4c2d-b648-974882eff08d

Demonstration of creating a new user and setting up an AGiXT agent's mandatory context training:

https://github.com/user-attachments/assets/2111009a-17e0-42e5-bcbc-843d127495e0

## Getting Started

If you don't already have AGiXT, [follow this link for instructions to set it up.](https://github.com/Josh-XT/AGiXT#quick-start-guide)

```bash
git clone https://github.com/agixt/interactive
cd interactive
```

Create a `.env` file and set the `AGIXT_SERVER` to your AGiXT server and `AGIXT_AGENT` for the default agent to use, then save and run the development server locally.

```bash
AGIXT_SERVER=https://localhost:7437
AGIXT_AGENT=XT
```

### Local Development

Install dependencies and run the development server.

```bash
npm install
npm run dev
```

Access at <http://localhost:3437>

## Environment Variables

The preferred method of configuration for standalone NextJS applications is using a `.env` file. The application will automatically handle the `NEXT_PUBLIC_` prefix internally, so you should set variables without this prefix in your `.env` file.

The following environment variables can be set:

| Variable Name | Default Value | Description |
| --- | --- | --- |
| `APP_NAME` | `AGiXT` | The name of the AGiXT application. |
| `APP_DESCRIPTION` | `An AGiXT application.` | Description of the AGiXT application. |
| `APP_URI` | `http://localhost:3437` | The URI of the AGiXT application. |
| `THEME_DEFAULT_MODE` | `dark` | The default theme mode for AGiXT. |
| `TZ` | `America/New_York` | The timezone used by the application. |
| `DEFAULT_THEME_MODE` | `dark` | Alternative setting for the default theme mode. |
| `ADSENSE_ACCOUNT` | `` | Google AdSense account ID if applicable. |
| `ENV` | `development` | Environment mode (development/production). |
| `LOG_VERBOSITY_CLIENT` | `3` | Client-side logging verbosity level. |
| `PRIVATE_ROUTES` | `/chat,/team,/settings/` | Routes that require authentication. |
| `AUTH_WEB` | `http://localhost:3437/user` | Authentication web endpoint. |
| `AGIXT_SERVER` | `https://api.app.agixt.chat` | The server address for AGiXT. |
| `ALLOW_EMAIL_SIGN_IN` | `true` | Whether to allow email sign-in. |
| `GITHUB_CLIENT_ID` | `` | GitHub OAuth client ID. |
| `GITHUB_SCOPES` | `repo user:email read:user workflow` | GitHub OAuth scopes. |
| `GOOGLE_CLIENT_ID` | `` | Google OAuth client ID. |
| `GOOGLE_SCOPES` | `https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/calendar.events.owned https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/gmail.modify` | Google OAuth scopes. |
| `MICROSOFT_CLIENT_ID` | `` | Microsoft OAuth client ID. |
| `MICROSOFT_SCOPES` | `offline_access User.Read Mail.Send Calendars.ReadWrite Calendars.ReadWrite.Shared` | Microsoft OAuth scopes. |
| `TESLA_CLIENT_ID` | `` | Tesla OAuth client ID. |
| `TESLA_SCOPES` | `openid offline_access user_data vehicle_device_data vehicle_cmds vehicle_charging_cmds vehicle_location` | Tesla OAuth scopes. |
| `COOKIE_DOMAIN` | `localhost` | Domain for cookies. |
| `AGIXT_API_KEY` | `` | API key for AGiXT. |
| `AGIXT_CONVERSATION` | `-` | The name of the conversation in AGiXT. |
| `AGIXT_CONVERSATION_MODE` | `static` | The mode of conversation in AGiXT (static, select, uuid). |
| `INTERACTIVE_UI` | `chat` | The interactive UI mode for AGiXT. |
| `AGIXT_SHOW_APP_BAR` | `true` | Whether to show the app bar in AGiXT. |
| `AGIXT_SHOW_SELECTION` | `` | Determines what selections are shown, comma-separated values of: 'agent', 'conversation', and/or 'prompt'. Defaults to 'conversation' if `AGIXT_CONVERSATION_MODE` is 'select'. |
| `AGIXT_FOOTER_MESSAGE` | `Powered by AGiXT` | The footer message displayed in AGiXT. |
| `AGIXT_RLHF` | `true` | Whether RLHF (Reinforcement Learning from Human Feedback) is enabled. |
| `AGIXT_SHOW_CHAT_THEME_TOGGLES` | `false` | Whether to show chat theme toggles. Defaults to `true` if `AGIXT_SHOW_APP_BAR` is `false`. |
| `AGIXT_FILE_UPLOAD_ENABLED` | `true` | Whether file upload is enabled. |
| `AGIXT_VOICE_INPUT_ENABLED` | `true` | Whether voice input is enabled. |
| `AGIXT_ALLOW_MESSAGE_EDITING` | `true` | Whether to allow message editing. |
| `AGIXT_ALLOW_MESSAGE_DELETION` | `true` | Whether to allow message deletion. |
| `AGIXT_SHOW_OVERRIDE_SWITCHES` | `tts,websearch` | Which override switches to show. |
| `AGIXT_ENABLE_SEARCHPARAM_CONFIG` | `true` | Whether to enable configuration via search parameters. |
| `AGIXT_MODE` | `prompt` | The mode of operation for AGiXT. |
| `AGIXT_AGENT` | `AGiXT` | The default agent used in AGiXT. |
| `AGIXT_INSIGHT_AGENT` | `` | The insight agent used in AGiXT. |
| `AGIXT_PROMPT_NAME` | `Think About It` | Default prompt name. |
| `AGIXT_PROMPT_CATEGORY` | `Default` | Default prompt category. |
| `AGIXT_COMMAND` | `` | Default command to execute. |
| `AGIXT_COMMAND_MESSAGE_ARG` | `message` | Argument name for command messages. |
| `AGIXT_CHAIN` | `` | Default chain to execute. |
| `AGIXT_CHAIN_ARGS` | `{}` | Arguments for the default chain. |

Configuration can also be set via search params / query params, if enabled via the `AGIXT_ENABLE_SEARCHPARAM_CONFIG` setting.

### Configuration Priority

The configuration system follows this priority order:

1. Search parameters / query parameters (if enabled)  
2. Environment variables set in the `.env` file
3. Default values defined in the application

### Example Advanced Configuration

For a more customized setup, you might use a `.env` file like:

```bash
APP_NAME=AGiXT
APP_DESCRIPTION=Custom AGiXT Implementation
AGIXT_SERVER=https://my-agixt-api.example.com
AGIXT_AGENT=CustomAgent
AGIXT_CONVERSATION_MODE=select
AGIXT_SHOW_SELECTION=agent,conversation,prompt
AGIXT_FILE_UPLOAD_ENABLED=true
AGIXT_VOICE_INPUT_ENABLED=true
AGIXT_SHOW_OVERRIDE_SWITCHES=tts,websearch,vision
```

## Contributing

Contributions are welcome! Please see the [Contributing Guide](CONTRIBUTING.md) for more information.
