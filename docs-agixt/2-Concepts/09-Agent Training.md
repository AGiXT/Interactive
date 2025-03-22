# Agent Training

AGiXT provides a flexible memory for agents allowing you to train them on any data you would like to be injected in context when interacting with the agent.

Training enables you to interact with just about any data with natural language.  You can train the agent on websites, files, and more.

## Mandatory Context: Your Agent's Personal Knowledge Base

**Mandatory Context** is your agent's permanent memory - information that will be included in every conversation automatically. This powerful feature allows you to customize your AI assistant with personalized knowledge that makes it uniquely valuable to you.

### What to Include in Your Mandatory Context

#### 1. Team Member Information

Add details about people you frequently mention:

```text
My team members:
- Nick (Nicholas Chen): Email: nick.chen@company.com, GitHub: @nickc92, Discord: NickC#1234
- Sarah (Sarah Wong): Email: swong@company.com, GitHub: @sarahw, Discord: SarahW#5678 
- Alex (Alexandra Kim): Email: akim@company.com, GitHub: @alexkim, Discord: AlexK#9012
```

#### 2. Personal Preferences

Tell your agent how you prefer to work:

```text
My preferences:
- Always send calendar invites with agenda items listed
- Format code examples with comments explaining each section
- I prefer bullet points over paragraphs for summaries
- When suggesting meeting times, prefer afternoons (2-4pm PST)
```

#### 3. Regular Workflows

Define common processes you want assistance with:

```text
When I ask to create a PR:
1. Use the ticket number in the branch name (format: feature/TICK-123-short-description)
2. Add "Resolves #123" in the PR description
3. Include my Solana wallet address for token rewards, it is 1234567890abcdef
4. Tag @techLead for review
```

#### 4. Communication Style Guidance

Set expectations for how your agent should respond:

```text
Communication style:
- Be direct and concise in responses
- Include a Russian vocabulary word with each response
- Always suggest next steps at the end of complex explanations
- When I say "ELI5" explain concepts as if to a 5-year-old
```

#### 5. Domain-Specific Knowledge

Add terminology, shortcuts, or internal references:

```text
Company acronyms:
- DRI = Directly Responsible Individual
- QBR = Quarterly Business Review
- LGTM = Looks Good To Me (approval)
```

### Pro Tips for Effective Mandatory Context

- **Be specific and clear** - The more precise your instructions, the better your agent will perform
- **Update regularly** as your needs evolve
- **Organize with headings** for easier reference
- **Prioritize frequently used information** that you don't want to repeat in every conversation
- **Think of this as programming your personal assistant** with your unique requirements

Your mandatory context can transform a generic AI into a personalized assistant that knows exactly how you work.

## Website Training

Enter a website URL then click `Train from Website` to train the agent on the website.  The agent will scape the websites information into its long term memory.  This will allow the agent to answer questions about the website.

## File Training

On the training page, the agent accepts file uploads of zip files, any kind of plain text file, PDF files, CSV, XLSX, and more. The agent will read the files into its long term memory. This will allow the agent to answer questions about the files.
