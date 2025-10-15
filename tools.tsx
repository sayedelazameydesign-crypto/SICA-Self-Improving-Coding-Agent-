/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { FunctionDeclaration, Type } from '@google/genai';

// ******************************************************
// 1. Tool Definitions (Function Declarations)
// ******************************************************
export const functionDeclarations: FunctionDeclaration[] = [
  {
    name: 'getWeather',
    description: 'Get the current weather in a given location.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        location: {
          type: Type.STRING,
          description: 'The city and state, e.g. San Francisco, CA',
        },
        unit: {
          type: Type.STRING,
          enum: ['celsius', 'fahrenheit'],
          description: 'The unit of temperature.',
        },
      },
      required: ['location'],
    },
  },
  {
    name: 'getCurrentTime',
    description: 'Get the current time in a given location.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        location: {
          type: Type.STRING,
          description: 'The city, e.g. Tokyo',
        },
      },
      required: ['location'],
    },
  },
  {
    name: 'controlFan',
    description: 'Control the speed and mode of a fan.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        speed: {
          type: Type.NUMBER,
          description: 'The speed of the fan, from 0 to 100.',
        },
        mode: {
          type: Type.STRING,
          enum: ['low', 'medium', 'high'],
          description: 'The mode of the fan.',
        },
      },
      required: ['speed', 'mode'],
    },
  },
  {
    name: 'search_github_repo',
    description:
      'Find best practices in open-source repositories and documentation.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        search_term: {
          type: Type.STRING,
          description: 'The topic or library to search for.',
        },
      },
      required: ['search_term'],
    },
  },
  {
    name: 'execute_code',
    description:
      'Execute Python code in a sandboxed environment for immediate testing and efficiency verification (use computer).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        code_block: {
          type: Type.STRING,
          description: 'The Python code to execute.',
        },
      },
      required: ['code_block'],
    },
  },
  {
    name: 'retrieve_knowledge',
    description:
      'Search and retrieve architectural expertise and lessons learned from long-term memory (Vector DB).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description:
            'The expertise or lesson to search for in the knowledge base.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'perform_code_critique',
    description:
      'Analyze execution logs and provide feedback or lessons learned from the code execution.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        code_block: {
          type: Type.STRING,
          description: 'The code that was executed.',
        },
        execution_logs: {
          type: Type.STRING,
          description: 'The logs or output from the code execution.',
        },
      },
      required: ['code_block', 'execution_logs'],
    },
  },
];

// ******************************************************
// 2. Mock Function Implementations
// ******************************************************
function getWeather({
  location,
  unit = 'fahrenheit',
}: {
  location: string;
  unit?: 'celsius' | 'fahrenheit';
}) {
  const temp = Math.floor(Math.random() * 40) + 10;
  return {
    temperature: `${temp}° ${unit === 'celsius' ? 'C' : 'F'}`,
    location,
  };
}

function getCurrentTime({ location }: { location: string }) {
  return { time: new Date().toLocaleTimeString(), location };
}

function controlFan({
  speed,
  mode,
}: {
  speed: number;
  mode: 'low' | 'medium' | 'high';
}) {
  return {
    status: 'success',
    message: `Fan set to ${speed}% speed in ${mode} mode.`,
  };
}

async function search_github_repo({ search_term }: { search_term: string }) {
  const GITHUB_API_URL = 'https://api.github.com/search/repositories';
  const query = encodeURIComponent(
    `${search_term} in:name,description,readme`,
  );
  const url = `${GITHUB_API_URL}?q=${query}&sort=stars&order=desc&per_page=5`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `GitHub API error! status: ${response.status}, message: ${errorData.message}`,
      );
    }

    const data = await response.json();

    const results = data.items.map((repo: any) => ({
      name: repo.full_name,
      url: repo.html_url,
      description: repo.description,
      stars: repo.stargazers_count,
    }));

    return {
      status: 'success',
      results_count: data.total_count,
      top_results: results,
      message: `Found ${data.total_count} repositories. Returning top 5 sorted by stars.`,
    };
  } catch (error) {
    console.error('GitHub repo search failed:', error);
    return {
      status: 'failure',
      error: `GitHub API request failed: ${error.message}`,
      message: 'Could not fetch repository data from GitHub.',
    };
  }
}

async function execute_code({ code_block }: { code_block: string }) {
  // ⚠️ This is a MOCK implementation for demonstration purposes.
  console.log(`Executing code (mocked):\n${code_block}`);
  await new Promise((resolve) => setTimeout(resolve, 500));
  return {
    status: 'success',
    output: `[Mock Execution] Code block received:\n---\n${code_block}\n---`,
    error: null,
    message: 'Code executed in a mocked secure environment.',
  };
}

function retrieve_knowledge({ query }: { query: string }) {
  return {
    knowledge: `Mock knowledge retrieved for query: '${query}'. SICA agents should be modular.`,
  };
}

function perform_code_critique({
  code_block,
  execution_logs,
}: {
  code_block: string;
  execution_logs: string;
}) {
  let critique = `Critique for code:\n---\n${code_block}\n---\nBased on logs:\n---\n${execution_logs}\n---\n`;
  if (execution_logs.toLowerCase().includes('error')) {
    critique += "Lesson Learned: The code failed. It's crucial to implement robust error handling, perhaps with try-catch blocks, to manage unexpected failures gracefully.";
  } else {
    critique += "This is a good start, but consider adding more comments and edge case handling for production environments."
  }
  return { critique };
}

// ******************************************************
// 3. Tool Dispatcher
// ******************************************************
export async function callTool(functionName: string, args: Record<string, any>) {
  switch (functionName) {
    case 'getWeather':
      return getWeather(args as any);
    case 'getCurrentTime':
      return getCurrentTime(args as any);
    case 'controlFan':
      return controlFan(args as any);
    case 'search_github_repo':
      return await search_github_repo(args as any);
    case 'execute_code':
      return await execute_code(args as any);
    case 'retrieve_knowledge':
      return retrieve_knowledge(args as any);
    case 'perform_code_critique':
      return perform_code_critique(args as any);
    default:
      throw new Error(`Unknown function: ${functionName}`);
  }
}
