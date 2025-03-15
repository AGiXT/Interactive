import axios, { AxiosRequestConfig } from 'axios';
import { getCookie, setCookie } from 'cookies-next';
import { get } from 'http';

export default class AGiXTSDK {
  private baseUri: string;
  private headers: AxiosRequestConfig['headers'];

  constructor() {
    let baseUri = process.env.NEXT_PUBLIC_AGIXT_SERVER || 'http://localhost:7437';
    if (baseUri.endsWith('/')) {
      baseUri = baseUri.slice(0, -1);
    }
    const jwt = getCookie('jwt') || '';
    this.baseUri = baseUri;
    this.headers = {
      Authorization: jwt,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(method: string, endpoint: string, data?: any, params?: any): Promise<T> {
    try {
      const response = await axios.request<T>({
        method,
        url: `${this.baseUri}${endpoint}`,
        data,
        params,
        headers: this.headers,
      });
      return response.data;
    } catch (error) {
      return `Error: ${error}` as T;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Auth Methods
  // ─────────────────────────────────────────────────────────────

  async login(email: string, otp: string): Promise<string> {
    const result = await this.request<any>('post', '/v1/login', { email, token: otp });
    let token = '';
    if (result.detail && result.detail.includes('?token=')) {
      token = result.detail.split('?token=')[1];
    } else if (result.token) {
      token = result.token;
    }
    this.headers = {
      ...this.headers,
      Authorization: token,
    };
    return token;
  }

  async registerUser(email: string, firstName: string, lastName: string, invitation_id?: string): Promise<string> {
    const result = await this.request<any>('post', '/v1/user', {
      email,
      first_name: firstName,
      last_name: lastName,
      invitation_id,
    });
    return result.otp_uri || '';
  }

  async userExists(email: string): Promise<boolean> {
    return this.request<boolean>('get', `/v1/user/exists?email=${encodeURIComponent(email)}`);
  }

  async updateUser(data: any): Promise<any> {
    return this.request<any>('put', '/v1/user', data);
  }

  async getUser(): Promise<any> {
    return this.request<any>('get', '/v1/user');
  }

  async deleteUser(): Promise<string> {
    return this.request<{ detail: string }>('delete', '/v1/user').then((r) => r.detail);
  }

  // ─────────────────────────────────────────────────────────────
  // Invitations Methods
  // ─────────────────────────────────────────────────────────────

  async getInvitations(companyId?: string): Promise<any[]> {
    const endpoint = companyId ? `/v1/invitations/${companyId}` : '/v1/invitations';
    return this.request<{ invitations: any[] }>('get', endpoint).then((r) => r.invitations);
  }

  async deleteInvitation(invitationId: string): Promise<string> {
    return this.request<{ detail: string }>('delete', `/v1/invitation/${invitationId}`).then((r) => r.detail);
  }

  async createInvitation(invitation: any): Promise<any> {
    return this.request<any>('post', '/v1/invitations', invitation);
  }

  // ─────────────────────────────────────────────────────────────
  // Verification & MFA Methods
  // ─────────────────────────────────────────────────────────────

  async verifyMfa(code: string): Promise<string> {
    return this.request<{ detail: string }>('post', '/v1/user/verify/mfa', { code }).then((r) => r.detail);
  }

  async verifySms(code: string): Promise<string> {
    return this.request<{ detail: string }>('post', '/v1/user/verify/sms', { code }).then((r) => r.detail);
  }

  async verifyEmail(email: string, code?: string): Promise<string> {
    return this.request<{ detail: string }>('post', '/v1/user/verify/email', { email, code }).then((r) => r.detail);
  }

  async sendMfaSms(email: string): Promise<string> {
    return this.request<{ detail: string }>('post', '/v1/user/mfa/sms', { email }).then((r) => r.detail);
  }

  async sendMfaEmail(email: string): Promise<string> {
    return this.request<{ detail: string }>('post', '/v1/user/mfa/email', { email }).then((r) => r.detail);
  }

  // ─────────────────────────────────────────────────────────────
  // OAuth2 Methods
  // ─────────────────────────────────────────────────────────────

  async oauthLogin(
    provider: string,
    code: string,
    referrer?: string,
  ): Promise<{ detail: string; email?: string; token?: string }> {
    return this.request<{ detail: string; email?: string; token?: string }>('post', `/v1/oauth2/${provider}`, {
      code,
      referrer,
    });
  }

  async updateOauthToken(provider: string, access_token: string, refresh_token?: string): Promise<string> {
    return this.request<{ detail: string }>('put', `/v1/oauth2/${provider}`, { access_token, refresh_token }).then(
      (r) => r.detail,
    );
  }

  async getOauthProviders(): Promise<string[]> {
    return this.request<string[]>('get', '/v1/oauth2');
  }

  async deleteOauthToken(provider: string): Promise<string> {
    return this.request<{ detail: string }>('delete', `/v1/oauth2/${provider}`).then((r) => r.detail);
  }

  // ─────────────────────────────────────────────────────────────
  // Companies Methods
  // ─────────────────────────────────────────────────────────────

  async getCompanies(): Promise<any[]> {
    return this.request<any[]>('get', '/v1/companies');
  }

  async createCompany(company: any): Promise<any> {
    return this.request<any>('post', '/v1/companies', company);
  }

  async deleteCompany(companyId: string): Promise<string> {
    return this.request<{ detail: string }>('delete', `/v1/companies/${companyId}`).then((r) => r.detail);
  }

  async deleteUserFromCompany(companyId: string, userId: string): Promise<string> {
    return this.request<{ detail: string }>('delete', `/v1/companies/${companyId}/users/${userId}`).then((r) => r.detail);
  }

  async getCompanyExtensions(companyId: string): Promise<any> {
    return this.request<any>('get', `/v1/companies/${companyId}/extensions`);
  }

  async toggleCompanyCommand(companyId: string, commandName: string, enable: boolean): Promise<string> {
    return this.request<{ message: string }>('patch', `/v1/companies/${companyId}/command`, {
      command_name: commandName,
      enable,
    }).then((r) => r.message);
  }

  async renameCompany(companyId: string, newName: string): Promise<any> {
    return this.request<any>('put', `/v1/companies/${companyId}`, { name: newName });
  }

  async updateUserRole(payload: any): Promise<string> {
    return this.request<{ detail: string }>('put', `/v1/user/role`, payload).then((r) => r.detail);
  }

  // Provider Methods
  async getProviders() {
    return this.request<{ providers: string[] }>('get', '/api/provider').then((r) => r.providers);
  }

  async getProvidersByService(service: string) {
    return this.request<{ providers: string[] }>('get', `/api/providers/service/${service}`).then((r) => r.providers);
  }

  async getAllProviders() {
    return this.request<{ providers: any[] }>('get', '/v1/providers').then((r) => r.providers);
  }

  async getProviderSettings(providerName: string) {
    return this.request<{ settings: any }>('get', `/api/provider/${providerName}`).then((r) => r.settings);
  }

  // Agent Methods
  async addAgent(agentName: string, settings: any = {}) {
    return this.request('post', '/api/agent', { agent_name: agentName, settings }).then((r) => r);
  }

  async importAgent(agentName: string, settings: any = {}, commands: any = {}) {
    return this.request('post', '/api/agent/import', { agent_name: agentName, settings, commands });
  }

  async renameAgent(agentName: string, newName: string) {
    return this.request('patch', `/api/agent/${agentName}`, { new_name: newName });
  }

  async updateAgentSettings(agentName: string, settings: any) {
    return this.request<{ message: string }>('put', `/api/agent/${agentName}`, { settings, agent_name: agentName }).then(
      (r) => r.message,
    );
  }

  async updateAgentCommands(agentName: string, commands: any) {
    return this.request<{ message: string }>('put', `/api/agent/${agentName}/commands`, {
      commands,
      agent_name: agentName,
    }).then((r) => r.message);
  }

  async deleteAgent(agentName: string) {
    return this.request<{ message: string }>('delete', `/api/agent/${agentName}`).then((r) => r.message);
  }

  async getAgents() {
    return this.request<{ agents: any[] }>('get', '/api/agent').then((r) => r.agents);
  }

  async getAgentConfig(agentName: string) {
    return this.request<{ agent: any }>('get', `/api/agent/${agentName}`).then((r) => r.agent);
  }

  // Conversation Methods
  async getConversations(objects = false, agentName?: string) {
    const url = objects ? '/v1/conversations' : agentName ? `/api/${agentName}/conversations` : '/api/conversations';
    return this.request<{ conversations: any[] }>('get', url).then((r) => r.conversations);
  }

  async addConversationFeedback(
    positive: boolean,
    agentName: string,
    message: string,
    userInput: string,
    feedback: string,
    conversationName: string,
  ) {
    return this.request<{ message: string }>('post', `/api/agent/${agentName}/feedback`, {
      positive,
      feedback,
      message,
      user_input: userInput,
      conversation_name: conversationName,
    }).then((r) => r.message);
  }

  async getConversation(conversationName = '', conversationId = '', limit = 100, page = 1, agentName?: string) {
    if (!conversationName && !conversationId) throw new Error('Must define either conversationName or conversationId.');
    if (conversationId && conversationName) throw new Error('Must define conversationName or conversationId, not both.');

    const url = conversationId ? `/v1/conversation/${conversationId}` : '/api/conversation/${conversationName}';
    const params = conversationId ? { limit, page } : { agent_name: agentName, limit, page };

    return this.request<{ conversation_history: any }>('get', url, null, params).then((r) => r.conversation_history);
  }

  async renameConversation(agentName: string, conversationName: string, newName = '-') {
    return this.request<{ conversation_name: string }>('put', '/api/conversation', {
      conversation_name: conversationName,
      new_conversation_name: newName,
      agent_name: agentName,
    }).then((r) => r.conversation_name);
  }

  async forkConversation(conversationName: string, messageId: string) {
    return this.request<{ message: string }>('post', '/api/conversation/fork', {
      conversation_name: conversationName,
      message_id: messageId,
    }).then((r) => r.message);
  }

  async newConversation(agentName: string, conversationName: string, conversationContent: any[] = []) {
    // return r.conversation_history and r.id
    return this.request<{ conversation_history: any[]; id: any }>('post', '/api/conversation', {
      conversation_name: conversationName,
      agent_name: agentName,
      conversation_content: conversationContent,
    }).then((r) => r);
  }

  async deleteConversation(conversationName: string, agentName?: string) {
    return this.request<{ message: string }>('delete', '/api/conversation', {
      conversation_name: conversationName,
      agent_name: agentName,
    }).then((r) => r.message);
  }

  // Message Methods
  async updateConversationMessage(conversationName: string, messageId: string, newMessage: string) {
    return this.request<{ message: string }>('put', `/api/conversation/message/${messageId}`, {
      conversation_name: conversationName,
      new_message: newMessage,
      message_id: messageId,
    }).then((r) => r.message);
  }

  async deleteConversationMessage(conversationName: string, messageId: string) {
    return this.request<{ message: string }>('delete', `/api/conversation/message/${messageId}`, {
      conversation_name: conversationName,
      message_id: messageId,
    }).then((r) => r.message);
  }

  // Memory Methods
  async importAgentMemories(agentName: string, memories: any[]) {
    return this.request<{ message: string }>('post', `/api/agent/${agentName}/memory/import`, {
      memories,
    }).then((r) => r.message);
  }

  async exportAgentMemories(agentName: string) {
    return this.request<{ memories: any }>('get', `/api/agent/${agentName}/memory/export`).then((r) => r.memories);
  }

  async wipeAgentMemories(agentName: string, collectionNumber = '0') {
    return this.request<{ message: string }>('delete', `/api/agent/${agentName}/memory/${collectionNumber}`).then(
      (r) => r.message,
    );
  }

  // Agent Interaction Methods
  async promptAgent(agentName: string, promptName: string = 'Think About It', promptArgs: any = {}) {
    return this.request<{ response: string }>('post', `/api/agent/${agentName}/prompt`, {
      prompt_name: promptName,
      prompt_args: promptArgs,
    }).then((r) => r.response);
  }

  // Command Methods
  async getCommands(agentName: string) {
    return this.request<{ commands: any }>('get', `/api/agent/${agentName}/command`).then((r) => r.commands);
  }

  async executeCommand(agentName: string, commandName: string, commandArgs: any, conversation: string) {
    return this.request<{ response: string }>('post', `/api/agent/${agentName}/command`, {
      command_name: commandName,
      command_args: commandArgs,
      conversation_name: conversation,
    }).then((r) => r.response);
  }

  async toggleCommand(agentName: string, commandName: string, enable: boolean) {
    return this.request<{ message: string }>('patch', `/api/agent/${agentName}/command`, {
      command_name: commandName,
      enable,
    }).then((r) => r.message);
  }

  // Chain Methods
  async getChains() {
    return this.request<string[]>('get', '/api/chain');
  }

  async getChain(chainName: string) {
    return this.request<{ chain: any }>('get', `/api/chain/${chainName}`).then((r) => r.chain);
  }

  async getChainResponses(chainName: string) {
    return this.request<{ chain: any }>('get', `/api/chain/${chainName}/responses`).then((r) => r.chain);
  }

  async getChainArgs(chainName: string) {
    return this.request<{ chain_args: string[] }>('get', `/api/chain/${chainName}/args`).then((r) => r.chain_args);
  }

  async runChain(chainName: string, userInput: string, agentName = '', allResponses = false, fromStep = 1, chainArgs = {}) {
    return this.request('post', `/api/chain/${chainName}/run`, {
      prompt: userInput,
      agent_override: agentName,
      all_responses: allResponses,
      from_step: fromStep,
      chain_args: chainArgs,
    });
  }

  async runChainStep(chainName: string, stepNumber: number, userInput: string, agentName?: string, chainArgs = {}) {
    return this.request('post', `/api/chain/${chainName}/run/step/${stepNumber}`, {
      prompt: userInput,
      agent_override: agentName,
      chain_args: chainArgs,
    });
  }

  async addChain(chainName: string) {
    return this.request<{ message: string }>('post', '/api/chain', {
      chain_name: chainName,
    }).then((r) => r.message);
  }

  async importChain(chainName: string, steps: any) {
    return this.request<{ message: string }>('post', '/api/chain/import', {
      chain_name: chainName,
      steps,
    }).then((r) => r.message);
  }

  async renameChain(chainName: string, newName: string) {
    return this.request<{ message: string }>('put', `/api/chain/${chainName}`, {
      new_name: newName,
    }).then((r) => r.message);
  }

  async deleteChain(chainName: string) {
    return this.request<{ message: string }>('delete', `/api/chain/${chainName}`).then((r) => r.message);
  }

  // Chain Step Methods
  async addStep(chainName: string, stepNumber: number, agentName: string, promptType: string, prompt: any) {
    return this.request<{ message: string }>('post', `/api/chain/${chainName}/step`, {
      step_number: stepNumber,
      agent_name: agentName,
      prompt_type: promptType,
      prompt,
    }).then((r) => r.message);
  }

  async updateStep(chainName: string, stepNumber: number, agentName: string, promptType: string, prompt: any) {
    return this.request<{ message: string }>('put', `/api/chain/${chainName}/step/${stepNumber}`, {
      step_number: stepNumber,
      agent_name: agentName,
      prompt_type: promptType,
      prompt,
    }).then((r) => r.message);
  }

  async moveStep(chainName: string, oldStepNumber: number, newStepNumber: number) {
    return this.request<{ message: string }>('patch', `/api/chain/${chainName}/step/move`, {
      old_step_number: oldStepNumber,
      new_step_number: newStepNumber,
    }).then((r) => r.message);
  }

  async deleteStep(chainName: string, stepNumber: number) {
    return this.request<{ message: string }>('delete', `/api/chain/${chainName}/step/${stepNumber}`).then((r) => r.message);
  }

  // Prompt Methods
  async addPrompt(promptName: string, prompt: string, promptCategory = 'Default') {
    return this.request<{ message: string }>('post', `/api/prompt/${promptCategory}`, {
      prompt_name: promptName,
      prompt,
    }).then((r) => r.message);
  }

  async getPrompt(promptName: string, promptCategory = 'Default') {
    return this.request<{ prompt: any }>('get', `/api/prompt/${promptCategory}/${promptName}`).then((r) => r.prompt);
  }

  async getPrompts(promptCategory = 'Default') {
    return this.request<{ prompts: string[] }>('get', `/api/prompt/${promptCategory}`).then((r) => r.prompts);
  }

  async addPromptCategory(promptCategory: string) {
    return this.request<{ prompts: string[] }>('get', `/api/prompt/${promptCategory}`).then(
      () => `Prompt category ${promptCategory} created.`,
    );
  }

  async getPromptCategories() {
    return this.request<{ prompt_categories: string[] }>('get', '/api/prompt/categories').then((r) => r.prompt_categories);
  }

  async getPromptArgs(promptName: string, promptCategory = 'Default') {
    return this.request<{ prompt_args: any }>('get', `/api/prompt/${promptCategory}/${promptName}/args`).then(
      (r) => r.prompt_args,
    );
  }

  async deletePrompt(promptName: string, promptCategory = 'Default') {
    return this.request<{ message: string }>('delete', `/api/prompt/${promptCategory}/${promptName}`).then((r) => r.message);
  }

  async updatePrompt(promptName: string, prompt: string, promptCategory = 'Default') {
    return this.request<{ message: string }>('put', `/api/prompt/${promptCategory}/${promptName}`, {
      prompt,
      prompt_name: promptName,
      prompt_category: promptCategory,
    }).then((r) => r.message);
  }

  async renamePrompt(promptName: string, newName: string, promptCategory = 'Default') {
    return this.request<{ message: string }>('patch', `/api/prompt/${promptCategory}/${promptName}`, {
      prompt_name: newName,
    }).then((r) => r.message);
  }

  // Extension Methods
  async getExtensionSettings() {
    return this.request<{ extension_settings: any }>('get', '/api/extensions/settings').then((r) => r.extension_settings);
  }

  async getExtensions() {
    return this.request<{ extensions: any[] }>('get', '/api/extensions').then((r) => r.extensions);
  }

  async getAgentExtensions(agentName: string) {
    return this.request<{ extensions: any[] }>('get', `/api/agent/${agentName}/extensions`).then((r) => r.extensions);
  }

  async getCommandArgs(commandName: string) {
    return this.request<{ command_args: any }>('get', `/api/extensions/${commandName}/args`).then((r) => r.command_args);
  }

  // Learning Methods
  async learnText(agentName: string, userInput: string, text: string, collectionNumber = '0') {
    return this.request<{ message: string }>('post', `/api/agent/${agentName}/learn/text`, {
      user_input: userInput,
      text,
      collection_number: collectionNumber,
    }).then((r) => r.message);
  }

  async learnUrl(agentName: string, url: string, collectionNumber = '0') {
    return this.request<{ message: string }>('post', `/api/agent/${agentName}/learn/url`, {
      url,
      collection_number: collectionNumber,
    }).then((r) => r.message);
  }

  async learnFile(agentName: string, fileName: string, fileContent: string, collectionNumber = '0') {
    return this.request<{ message: string }>('post', `/api/agent/${agentName}/learn/file`, {
      file_name: fileName,
      file_content: fileContent,
      collection_number: collectionNumber,
    }).then((r) => r.message);
  }

  // Memory Query Methods
  async getAgentMemories(agentName: string, userInput: string, limit = 5, minRelevanceScore = 0.5, collectionNumber = '0') {
    return this.request<{ memories: any }>('post', `/api/agent/${agentName}/memory/${collectionNumber}/query`, {
      user_input: userInput,
      limit,
      min_relevance_score: minRelevanceScore,
    }).then((r) => r.memories);
  }

  async deleteAgentMemory(agentName: string, memoryId: string, collectionNumber = '0') {
    return this.request<{ message: string }>(
      'delete',
      `/api/agent/${agentName}/memory/${collectionNumber}/${memoryId}`,
    ).then((r) => r.message);
  }

  async createDataset(agentName: string, datasetName: string, batchSize = 4) {
    return this.request<{ message: string }>('post', `/api/agent/${agentName}/memory/dataset`, {
      dataset_name: datasetName,
      batch_size: batchSize,
    }).then((r) => r.message);
  }

  // Feedback Methods
  async positiveFeedback(agentName: string, message: string, userInput: string, feedback: string, conversationName = '') {
    return this.provideFeedback(agentName, message, userInput, feedback, true, conversationName);
  }

  async negativeFeedback(agentName: string, message: string, userInput: string, feedback: string, conversationName = '') {
    return this.provideFeedback(agentName, message, userInput, feedback, false, conversationName);
  }

  private async provideFeedback(
    agentName: string,
    message: string,
    userInput: string,
    feedback: string,
    positive: boolean,
    conversationName: string,
  ) {
    return this.request<{ message: string }>('post', `/api/agent/${agentName}/feedback`, {
      user_input: userInput,
      message,
      feedback,
      positive,
      conversation_name: conversationName,
    }).then((r) => r.message);
  }

  // Browsing and External Sources Methods
  async getBrowsedLinks(agentName: string, collectionNumber = '0') {
    return this.request<{ links: string[] }>('get', `/api/agent/${agentName}/browsed_links/${collectionNumber}`).then(
      (r) => r.links,
    );
  }

  async deleteBrowsedLink(agentName: string, link: string, collectionNumber = '0') {
    return this.request<{ message: string }>('delete', `/api/agent/${agentName}/browsed_links`, {
      link,
      collection_number: collectionNumber,
    }).then((r) => r.message);
  }

  async getMemoriesExternalSources(agentName: string, collectionNumber: string) {
    return this.request<{ external_sources: any }>(
      'get',
      `/api/agent/${agentName}/memory/external_sources/${collectionNumber}`,
    ).then((r) => r.external_sources);
  }

  async deleteMemoryExternalSource(agentName: string, source: string, collectionNumber: string) {
    return this.request<{ message: string }>('delete', `/api/agent/${agentName}/memory/external_source`, {
      external_source: source,
      collection_number: collectionNumber,
    }).then((r) => r.message);
  }

  // Persona Methods
  async getPersona(agentName: string) {
    return this.request<{ persona: any }>('get', `/api/agent/${agentName}/persona`).then((r) => r.persona);
  }

  async updatePersona(agentName: string, persona: string) {
    return this.request<{ message: string }>('put', `/api/agent/${agentName}/persona`, { persona }).then((r) => r.message);
  }

  async textToSpeech(agentName: string, text: string) {
    return this.request<{ url: string }>('post', `/api/agent/${agentName}/text_to_speech`, { text }).then((r) => r.url);
  }

  // Conversation Message Methods
  async newConversationMessage(role: string, message: string, conversationName: string) {
    return this.request<{ message: string }>('post', '/api/conversation/message', {
      role,
      message,
      conversation_name: conversationName,
    }).then((r) => r.message);
  }

  async getConversationsWithIds() {
    return this.request<{ conversations_with_ids: any }>('get', '/api/conversations').then((r) => r.conversations_with_ids);
  }

  async chatCompletions(messages: any[]) {
    const currentConversation = getCookie('agixt-conversation');
    const completionResponse = await axios.post(
      `${this.baseUri}/v1/chat/completions`,
      {
        messages: messages,
        model: getCookie('agixt-agent'),
        user: currentConversation,
      },
      {
        headers: this.headers,
      },
    );
    if (completionResponse.status === 200) {
      const chatCompletion = completionResponse.data;
      if (currentConversation !== chatCompletion.id) {
        // Set the conversation ID in the cookie
        setCookie('agixt-conversation', chatCompletion.id, { domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN });
      }
      return chatCompletion;
    } else {
      throw 'Failed to get response from the agent';
    }
  }
}
