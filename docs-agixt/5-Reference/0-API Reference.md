# API Reference

Our REST API documentation is available at your AGiXT server's `/redoc` endpoint. 

For example, if your AGiXT server is running at `http://localhost:7437`, you can access the API documentation at `http://localhost:7437/redoc`.

## Authentication

Most API endpoints require authentication. You can authenticate your requests using:

1. API Key in the request header
2. Bearer token for authenticated sessions

## Base URL

The base URL for all API endpoints is your AGiXT server address. Configure this in your environment variables using `NEXT_PUBLIC_AGIXT_SERVER`.

## Common Endpoints

- `/agents` - Manage AI agents
- `/conversations` - Handle chat conversations
- `/commands` - Access available commands
- `/prompts` - Manage prompt templates
- `/chains` - Work with command chains

For detailed endpoint documentation, parameter specifications, and example requests, visit the full API documentation at your AGiXT server's `/redoc` endpoint.