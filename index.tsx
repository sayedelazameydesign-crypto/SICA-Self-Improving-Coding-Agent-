/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GoogleGenAI,
  Content,
} from '@google/genai';
import { functionDeclarations, callTool } from './tools.tsx';

// Note: The API key is stored in the `.env` file.
const API_KEY = process.env.API_KEY;

const ai = new GoogleGenAI({ apiKey: API_KEY });

const messagesEl = document.getElementById('messages');
const loadingEl = document.getElementById('loading');
const formEl = document.getElementById('prompt-form') as HTMLFormElement;
const inputEl = document.getElementById('prompt-input') as HTMLInputElement;
const submitButton = formEl.querySelector('button');

// SICA System Instruction
const SICA_SYSTEM_INSTRUCTION = `You are SICA, a Self-Improving Intelligent Coding Agent. Your primary directive is to operate as an expert architect and programmer.

Your core principles are:
1.  **Architectural Planning First (Pathfinding):** Before writing any code, you MUST formulate a step-by-step plan. Use 'retrieve_knowledge' or 'search_github_repo' to research best practices and create a robust architectural plan. Present this plan first.
2.  **Efficient & Secure Execution:** When asked to execute code, you MUST use the 'execute_code' function, which runs in a secure, sandboxed environment.
3.  **Self-Improvement & Learning:** If an execution fails or performs poorly (e.g., errors, high memory usage), you MUST use the 'perform_code_critique' function to analyze the failure, extract a lesson, and record it.
4.  **Tool Integration:** For complex queries, you MUST combine multiple tools in a single turn to provide a comprehensive answer.`;

type MessagePayload =
  | string
  | { functionName: string; args: Record<string, any> }
  | { functionName: string; result: any };

function addMessage(
  payload: MessagePayload,
  type: 'user' | 'model' | 'tool-call' | 'tool-result',
) {
  const messageEl = document.createElement('div');
  messageEl.classList.add('message', type);

  // FIX: Added 'args' in payload to narrow the type of payload for tool calls.
  if (type === 'tool-call' && typeof payload === 'object' && 'args' in payload) {
    messageEl.innerHTML = `
      <div class="tool-header">
        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#5f6368"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>
        <span>Calling Tool: <strong>${payload.functionName}</strong></span>
      </div>
      <pre>${JSON.stringify(payload.args, null, 2)}</pre>
    `;
  // FIX: Added 'result' in payload to narrow the type of payload for tool results.
  } else if (type === 'tool-result' && typeof payload === 'object' && 'result' in payload) {
    let resultHtml = '';
    // Custom renderer for GitHub repo search
    if (
      payload.functionName === 'search_github_repo' &&
      payload.result.status === 'success'
    ) {
      const repos = payload.result.top_results;
      resultHtml = `
        <p>${payload.result.message}</p>
        <ul class="repo-list">
          ${repos
            .map(
              (repo: any) => `
            <li class="repo-item">
              <div class="repo-header">
                <a href="${repo.url}" target="_blank" rel="noopener noreferrer">${repo.name}</a>
                <span class="repo-stats">
                  <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 0 24 24" width="16px" fill="#5f6368"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27z"/></svg>
                  ${repo.stars.toLocaleString()}
                </span>
              </div>
              <p class="repo-description">${repo.description || 'No description available.'}</p>
            </li>
          `,
            )
            .join('')}
        </ul>
      `;
    } else {
      // Default renderer for other tools
      resultHtml = `<pre>${JSON.stringify(payload.result, null, 2)}</pre>`;
    }

    messageEl.innerHTML = `
      <div class="tool-header">
         <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#5f6368"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>
        <span>Result from <strong>${payload.functionName}</strong></span>
      </div>
      ${resultHtml}
    `;
  } else {
    messageEl.textContent = payload as string;
  }

  messagesEl.appendChild(messageEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ******************************************************
// Agent Orchestration Loop
// ******************************************************
async function handleFormSubmit(e: Event) {
  e.preventDefault();
  const prompt = inputEl.value.trim();
  if (!prompt) return;

  formEl.reset();
  setLoading(true);
  addMessage(prompt, 'user');

  try {
    const userMessage: Content = { role: 'user', parts: [{ text: prompt }] };
    let history: Content[] = [userMessage];

    let currentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: history,
      config: {
        systemInstruction: SICA_SYSTEM_INSTRUCTION,
        tools: [{ functionDeclarations }],
      },
    });

    // Multi-turn function calling loop
    while (
      currentResponse.functionCalls &&
      currentResponse.functionCalls.length > 0
    ) {
      const functionCalls = currentResponse.functionCalls;
      const toolResponses: { name: string; response: any }[] = [];

      // Add the model's function-calling response to history
      history.push(currentResponse.candidates[0].content);

      for (const call of functionCalls) {
        const functionName = call.name;
        const args = call.args as Record<string, any>;

        addMessage({ functionName, args }, 'tool-call');

        try {
          // 1. Execute the actual function
          const resultOutput = await callTool(functionName, args);

          // 2. Add result to message history and toolResponses
          addMessage({ functionName, result: resultOutput }, 'tool-result');
          toolResponses.push({
            name: functionName,
            response: resultOutput,
          });
        } catch (e) {
          const errorResult = {
            error: `Function Execution Failed: ${e.message}`,
          };
          addMessage({ functionName, result: errorResult }, 'tool-result');
          toolResponses.push({
            name: functionName,
            response: errorResult,
          });
          console.error(`Error executing tool ${functionName}:`, e);
        }
      }

      // 3. Send tool results back to the model to read and respond
      const toolParts = toolResponses.map((r) => ({
        functionResponse: { name: r.name, response: r.response },
      }));

      const toolResponse: Content = { role: 'tool', parts: toolParts };
      history.push(toolResponse);

      currentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: history,
        config: { systemInstruction: SICA_SYSTEM_INSTRUCTION, tools: [{ functionDeclarations }] },
      });
    }

    // Display the final response
    addMessage(currentResponse.text, 'model');
  } catch (error) {
    console.error(error);
    addMessage('An error occurred. Please check the console.', 'model');
  } finally {
    setLoading(false);
  }
}

function setLoading(isLoading: boolean) {
  if (isLoading) {
    loadingEl.classList.remove('hidden');
    submitButton.disabled = true;
    inputEl.disabled = true;
  } else {
    loadingEl.classList.add('hidden');
    submitButton.disabled = false;
    inputEl.disabled = false;
    inputEl.focus();
  }
}

formEl.addEventListener('submit', handleFormSubmit);

// Add a welcome message
addMessage(
  "Hello! I am SICA, a Self-Improving Intelligent Coding Agent. How can I assist you with your architectural and coding needs today?",
  'model',
);
