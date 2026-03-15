/**
 * Storage module - manages prompts in chrome.storage.local
 * Production version with default templates + memory cache
 */

const STORAGE_KEY = "promptManager_prompts";

const DEFAULT_PROMPTS = [
  {
    id: "tpl_explain_code",
    title: "Explain Code",
    text: "Explain the following code step by step and describe what each part does.",
    type: "template",
    createdAt: 0
  },
  {
    id: "tpl_fix_code",
    title: "Fix Bug",
    text: "Find the bug in the following code and explain how to fix it.",
    type: "template",
    createdAt: 0
  },
  {
    id: "tpl_improve_writing",
    title: "Improve Writing",
    text: "Improve the clarity and professionalism of the following text.",
    type: "template",
    createdAt: 0
  },
  {
    id: "tpl_translate",
    title: "Translate",
    text: "Translate the following text into English while keeping the meaning natural.",
    type: "template",
    createdAt: 0
  },
  {
    id: "tpl_summarize",
    title: "Summarize",
    text: "Summarize the following content into concise bullet points.",
    type: "template",
    createdAt: 0
  },
  {
    id: "tpl_seo",
    title: "SEO Article",
    text: "Write an SEO optimized article about the following topic with headings and keywords.",
    type: "template",
    createdAt: 0
  },
  {
    id: "tpl_marketing",
    title: "Marketing Copy",
    text: "Write persuasive marketing copy for the following product.",
    type: "template",
    createdAt: 0
  },
  {
    id: "tpl_email",
    title: "Professional Email",
    text: "Write a professional email for the following situation.",
    type: "template",
    createdAt: 0
  },
  {
    id: "tpl_debug",
    title: "Debug Code",
    text: "Analyze the following code and identify potential problems or improvements.",
    type: "template",
    createdAt: 0
  },
  {
    id: "tpl_product",
    title: "Product Description",
    text: "Write a compelling product description for the following item.",
    type: "template",
    createdAt: 0
  }
];

let cachedPrompts = null;

function generateId() {
  return "pm_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
}

async function getPrompts() {
  if (Array.isArray(cachedPrompts)) {
    return cachedPrompts;
  }

  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    let prompts = result[STORAGE_KEY];

    if (!Array.isArray(prompts) || prompts.length === 0) {
      prompts = [...DEFAULT_PROMPTS];
      await chrome.storage.local.set({ [STORAGE_KEY]: prompts });
    }

    cachedPrompts = prompts;
    return cachedPrompts;
  } catch (err) {
    console.warn("[Prompt Manager] getPrompts error:", err);
    cachedPrompts = [...DEFAULT_PROMPTS];
    return cachedPrompts;
  }
}

async function savePrompt(prompt) {
  if (!prompt || typeof prompt !== "object") return null;

  const title = String(prompt.title || "").trim();
  const text = String(prompt.text || "").trim();

  if (!title && !text) return null;

  const prompts = await getPrompts();

  const newPrompt = {
  id: prompt.id || generateId(),
  title: title || 'Untitled',
  text: text,
  type: 'saved',
  createdAt: prompt.createdAt || Date.now()
};
  const updated = [newPrompt, ...prompts];
  await updatePrompts(updated);

  return newPrompt;
}

async function deletePrompt(id) {
  if (!id) return false;

  const prompts = await getPrompts();
  const filtered = prompts.filter(function (p) {
    return p.id !== id;
  });

  if (filtered.length === prompts.length) return false;

  await updatePrompts(filtered);
  return true;
}

async function updatePrompts(prompts) {
  try {
    const safePrompts = Array.isArray(prompts) ? prompts : [];
    cachedPrompts = safePrompts;
    await chrome.storage.local.set({ [STORAGE_KEY]: safePrompts });
    return true;
  } catch (err) {
    console.warn("[Prompt Manager] updatePrompts error:", err);
    return false;
  }
}

async function refreshPromptsCache() {
  cachedPrompts = null;
  return await getPrompts();
}