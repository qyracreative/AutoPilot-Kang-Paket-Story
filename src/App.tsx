/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { 
  Truck, 
  User, 
  Cloud, 
  Film, 
  Send, 
  Copy, 
  Check, 
  RefreshCw, 
  Camera, 
  Volume2, 
  MessageSquare,
  Sparkles,
  Package,
  Table,
  BookOpen
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

// --- Types ---

interface Character {
  name: string;
  type: string;
  visual: string;
  personality: string;
  traits: string;
  characteristic: string;
  vibe: string;
  outfit: string;
  location?: string;
  vehicle?: string;
  package?: string;
  reaction?: string;
}

interface Environment {
  weather: string;
  atmosphere: string;
  tone: string;
}

interface Scene {
  sceneNumber: number;
  visualDescription: string;
  cameraMovement: string;
  sfx: string;
  dialogue: string;
}

interface SocialPlatform {
  title: string;
  description: string;
  hashtags: string[];
}

interface GeneratedPrompt {
  title: string;
  storyOverview: string;
  scenes: Scene[];
  courierImagePrompt: string;
  recipientImagePrompt: string;
  socialMedia: {
    facebook: SocialPlatform;
    youtube: SocialPlatform;
    tiktok: SocialPlatform;
  };
}

// --- Constants ---

const DEFAULT_COURIER: Character = {
  name: "",
  type: "",
  visual: "",
  personality: "",
  traits: "",
  characteristic: "",
  vibe: "",
  outfit: "",
  vehicle: "",
};

const DEFAULT_RECIPIENT: Character = {
  name: "",
  type: "",
  visual: "",
  personality: "",
  traits: "",
  characteristic: "",
  vibe: "",
  outfit: "",
  location: "",
  package: "",
  reaction: "",
};

const DEFAULT_ENV: Environment = {
  weather: "",
  atmosphere: "",
  tone: "",
};

// --- App Component ---

const getParams = () => {
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');

  return {
    courier: {
      name: params.get("courier_name") || "",
      type: params.get("courier_type") || "",
      visual: params.get("courier_visual") || "",
      personality: params.get("courier_personality") || "",
      traits: params.get("courier_traits") || "",
      characteristic: params.get("courier_characteristic") || "",
      vibe: params.get("courier_vibe") || params.get("courier_vide") || "",
      outfit: params.get("courier_outfit") || "",
      vehicle: params.get("courier_vehicle") || "",
    },
    recipient: {
      name: params.get("recipient_name") || "",
      type: params.get("recipient_type") || "",
      visual: params.get("recipient_visual") || "",
      personality: params.get("recipient_personality") || "",
      traits: params.get("recipient_traits") || "",
      characteristic: params.get("recipient_characteristic") || "",
      vibe: params.get("recipient_vibe") || params.get("recipient_vide") || "",
      outfit: params.get("recipient_outfit") || "",
      location: params.get("recipient_location") || "",
      package: params.get("recipient_package") || "",
      reaction: params.get("recipient_reaction") || "",
    },
    env: {
      weather: params.get("weather") || "",
      atmosphere: params.get("atmosphere") || "",
      tone: params.get("tone") || "",
    }
  };
};

export default function App() {
  const params = getParams();
  
  const [courier, setCourier] = useState<Character>(params.courier);
  const [recipient, setRecipient] = useState<Character>(params.recipient);
  const [env, setEnv] = useState<Environment>(params.env);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState<GeneratedPrompt | null>(null);
  const [errorHeader, setErrorHeader] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedSceneIdx, setCopiedSceneIdx] = useState<number | null>(null);

  // --- Real-time Clock ---
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatJakartaTime = (date: Date) => {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(date);
  };

  const jakartaTime = formatJakartaTime(currentTime);

  // --- Autopilot States ---
  const [gasUrl, setGasUrl] = useState(
    (import.meta as any).env?.VITE_GOOGLE_APPS_SCRIPT_URL ||
    localStorage.getItem('gas_url') || 
    "https://script.google.com/macros/s/AKfycbxVnHwT0cMLBOJqBfuPiBI1rpuv6sHrGRNW6R0CLwptLG9i0cmnH_acgllLAi0xbZBI/exec?action=getQueue&sheet=Story"
  );
  const [gasCopied, setGasCopied] = useState(false);
  const [isAutopilotActive, setIsAutopilotActive] = useState(localStorage.getItem('autopilot_active') === 'true');
  const [autopilotStatus, setAutopilotStatus] = useState("Idle");
  const [countdown, setCountdown] = useState(0);
  const [currentQueueItem, setCurrentQueueItem] = useState<any>(null);

  useEffect(() => {
    localStorage.setItem('gas_url', gasUrl);
  }, [gasUrl]);

  useEffect(() => {
    localStorage.setItem('autopilot_active', isAutopilotActive.toString());
  }, [isAutopilotActive]);

  // --- Autopilot Logic Functions ---

  const getRequestUrl = (baseUrl: string, extraParams: Record<string, any>) => {
    try {
      const urlObj = new URL(baseUrl.trim());
      // Set the extra parameters, overwriting any existing ones
      Object.keys(extraParams).forEach((key) => {
        urlObj.searchParams.set(key, String(extraParams[key]));
      });
      return urlObj.toString();
    } catch (e) {
      // Fallback if URL constructor fails
      let trimmed = baseUrl.trim();
      const questionIndex = trimmed.indexOf("?");
      let urlBase = trimmed;
      const queryParams: Record<string, string> = {};

      if (questionIndex !== -1) {
        urlBase = trimmed.substring(0, questionIndex);
        const search = trimmed.substring(questionIndex + 1);
        search.split("&").forEach((part) => {
          const [key, val] = part.split("=");
          if (key) {
            queryParams[decodeURIComponent(key)] = val ? decodeURIComponent(val) : "";
          }
        });
      }

      // Merge params
      const merged = { ...queryParams, ...extraParams };
      let finalUrl = urlBase;
      let isFirst = true;
      Object.keys(merged).forEach((key) => {
        const prefix = isFirst ? "?" : "&";
        finalUrl += `${prefix}${encodeURIComponent(key)}=${encodeURIComponent(merged[key])}`;
        isFirst = false;
      });
      return finalUrl;
    }
  };

  const fetchQueue = async () => {
    const trimmedUrl = gasUrl.trim();
    if (!trimmedUrl) {
      setAutopilotStatus("URL Kosong!");
      return null;
    }
    
    if (!trimmedUrl.includes("/exec")) {
      setAutopilotStatus("URL Salah (Harus /exec)");
      return null;
    }

    try {
      setAutopilotStatus("Mencari antrian...");
      const res = await executeGasRequest("GET", "getQueue", {});
      const text = await res.text();
      
      if (text.trim().startsWith("Error:")) {
        throw new Error(text.trim());
      }

      let item;
      try {
        item = JSON.parse(text);
      } catch (e) {
        throw new Error(`Response bukan JSON: ${text.slice(0, 80)}`);
      }

      if (item && item.rowIndex) {
        setCurrentQueueItem(item);
        setCourier(item.courier);
        setRecipient(item.recipient);
        setEnv(item.world);
        return item;
      }
      return item;
    } catch (err: any) {
      console.error("Queue fetch failed:", err);
      if (err.message.includes("Failed to fetch")) {
        setAutopilotStatus("Gagal menghubungi Google Sheet. Pastikan GAS di-deploy 'Anyone' & cek internet.");
      } else {
        setAutopilotStatus(`Error: ${err.message}`);
      }
      return null;
    }
  };

  const executeGasRequest = async (
    method: "GET" | "POST",
    action: string,
    params: Record<string, any> = {},
    bodyData?: Record<string, any>
  ) => {
    const trimmedUrl = gasUrl.trim();
    if (!trimmedUrl) {
      throw new Error("URL Kosong!");
    }

    // Detect if we can use the local server-side proxy
    let useProxy = false;
    try {
      const healthRes = await fetch("/api/health");
      if (healthRes.ok) {
        const healthData = await healthRes.json();
        if (healthData && healthData.status === "ok") {
          useProxy = true;
        }
      }
    } catch (e) {
      useProxy = false;
    }

    if (useProxy) {
      console.log(`[GAS-PROXY] Forwarding action: ${action} through express dev proxy...`);
      if (method === "GET") {
        const requestUrl = getRequestUrl("/api/gas-proxy", {
          ...params,
          action,
          targetUrl: trimmedUrl
        });
        const res = await fetch(requestUrl, { method: "GET" });
        if (!res.ok) throw new Error(`HTTP ${res.status} from proxy`);
        return res;
      } else {
        const res = await fetch("/api/gas-proxy", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            targetUrl: trimmedUrl,
            action,
            ...bodyData
          })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} from proxy`);
        return res;
      }
    } else {
      console.log(`[GAS-DIRECT] Client-side fetch action: ${action} directly to Apps Script...`);
      if (method === "GET") {
        const requestUrl = getRequestUrl(trimmedUrl, {
          ...params,
          action
        });
        const res = await fetch(requestUrl, { 
          method: "GET",
          mode: "cors"
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} (Direct fetch)`);
        return res;
      } else {
        const requestUrl = getRequestUrl(trimmedUrl, { action });
        const postParams = new URLSearchParams();
        if (bodyData) {
          Object.keys(bodyData).forEach(key => {
            postParams.append(key, String(bodyData[key]));
          });
        }
        
        try {
          const res = await fetch(requestUrl, {
            method: "POST",
            body: postParams,
          });
          return res;
        } catch (postErr) {
          console.warn("[GAS-DIRECT] Direct CORS POST blocked by browser or failed, fallback to no-cors POST...", postErr);
          const res = await fetch(requestUrl, {
            method: "POST",
            mode: "no-cors",
            body: postParams
          });
          return {
            ok: true,
            status: 200,
            text: async () => "Success (no-cors fallback)"
          } as any;
        }
      }
    }
  };

  const updateStatus = async (status: string, rowIndex: number) => {
    try {
      const timestamp = new Date().getTime();
      const res = await executeGasRequest("GET", "updateStatus", {
        status: status,
        rowIndex: rowIndex,
        cb: timestamp
      });
      const text = await res.text();
      console.log(`Status update response: ${text}`);
      if (text.includes("Error:") || text.includes("not found")) {
        throw new Error(text.trim());
      }
      console.log(`Status update requested: ${status} for row ${rowIndex}`);
    } catch (e: any) {
      console.error("Update status failed", e);
      throw e;
    }
  };

  const uploadResults = async (prompt: GeneratedPrompt, rowIndex: number) => {
    const fbHashtags = (prompt.socialMedia.facebook.hashtags || []).map(h => h.startsWith('#') ? h : '#' + h).join(' ');
    const fbContent = `${prompt.socialMedia.facebook.title || ""}\n\n${prompt.socialMedia.facebook.description || ""}\n\n${fbHashtags}`;
    
    const ytHashtags = (prompt.socialMedia.youtube.hashtags || []).map(h => h.replace(/^#/, '')).join(',');
    
    const ttHashtags = (prompt.socialMedia.tiktok.hashtags || []).map(h => h.startsWith('#') ? h : '#' + h).join(' ');
    const ttContent = `${prompt.socialMedia.tiktok.title || ""}\n\n${prompt.socialMedia.tiktok.description || ""}\n\n${ttHashtags}`;

    const fullPromptText = getFullPromptText(prompt);

    try {
      const res = await executeGasRequest("POST", "updateResults", {}, {
        rowIndex: rowIndex.toString(),
        fullPrompt: fullPromptText,
        facebook: fbContent,
        ytTitle: prompt.socialMedia.youtube.title || "",
        ytDesc: prompt.socialMedia.youtube.description || "",
        ytHashtags: ytHashtags,
        tiktok: ttContent
      });
      
      const text = await res.text();
      console.log("Upload results response:", text);
      if (text.includes("Error:") || text.includes("not found")) {
        throw new Error(text.trim());
      }
      
      console.log("Upload results requested for row:", rowIndex);
    } catch (e: any) {
      console.error("Upload results failed", e);
      throw e;
    }
  };

  const getFullPromptText = (prompt: GeneratedPrompt) => {
    let text = `Veo Cinematic Prompt: ${prompt.title}\n\n`;
    text += `CHARACTER VISUAL PROMPTS:\nCourier: ${prompt.courierImagePrompt}\nRecipient: ${prompt.recipientImagePrompt}\n\n`;
    text += `STORY OVERVIEW:\n${prompt.storyOverview}\n\n`;
    prompt.scenes.forEach(s => {
      text += `SCENE ${s.sceneNumber}\nVisual: ${s.visualDescription}\nCamera: ${s.cameraMovement}\nSFX: ${s.sfx}\nDialogue: "${s.dialogue}"\n\n`;
    });
    return text;
  };

  // --- Autopilot Lifecycle ---
  useEffect(() => {
    let timer: any;
    let isActive = true;

    const runCycle = async () => {
      if (!isAutopilotActive || !isActive) return;

      try {
        // 1. Fetch
        const item = await fetchQueue();
        if (!item || item.message === "Empty") {
          setAutopilotStatus("Tidak ada antrian. Menunggu 3 menit...");
          setCountdown(180);
          timer = setTimeout(runCycle, 180000);
          return;
        }

        if (!isAutopilotActive || !isActive) return;

        // 2. Short pause for user to see the data
        setAutopilotStatus("Data terisi. Menyiapkan proses (3 detik)...");
        setCountdown(3);
        await new Promise(r => setTimeout(r, 3000));

        if (!isAutopilotActive || !isActive) return;

        // 3. Update status to Processing & Start Generation
        setAutopilotStatus("Sedang men-generate...");
        await updateStatus("Processing", item.rowIndex);
        
        // Pass item data directly to avoid stale closures
        const result = await regenerate(item.courier, item.recipient, item.world); 
        
        if (!result || !isAutopilotActive || !isActive) return;

        // 4. Verification Pause
        setAutopilotStatus("Hasil siap. Silakan koreksi (3 detik)...");
        setCountdown(3);
        await new Promise(r => setTimeout(r, 3000));

        if (!isAutopilotActive || !isActive) return;

        // 5. Upload to Sheet
        setAutopilotStatus("Mengirim hasil ke Sheet...");
        await uploadResults(result, item.rowIndex);

        // 6. Final Pause before next cycle (3 minutes)
        setAutopilotStatus("Selesai! Mencari antrian berikutnya dalam 3 menit...");
        setCountdown(180);
        await new Promise(r => setTimeout(r, 180000));
        
        if (!isAutopilotActive || !isActive) return;

        // Loop directly instead of full reload to prevent UI flicker and maintain state
        runCycle();

      } catch (err: any) {
        console.error("Autopilot cycle failed:", err);
        setAutopilotStatus(`Gagal: ${err.message || err}. Mengulang dalam 15 detik...`);
        setCountdown(15);
        timer = setTimeout(runCycle, 15000);
      }
    };

    if (isAutopilotActive) {
      runCycle();
    } else {
      setAutopilotStatus("Idle");
      setCountdown(0);
    }

    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [isAutopilotActive]);

  // Removed the split handleResult useEffect to avoid race conditions

  // Countdown timer
  useEffect(() => {
    let interval: any;
    if (countdown > 0) {
      interval = setInterval(() => setCountdown(c => c - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [countdown]);

  const regenerate = async (overCourier?: Character, overRecipient?: Character, overEnv?: Environment) => {
    // Use override parameters if provided (for Autopilot precision)
    const activeCourier = overCourier || courier;
    const activeRecipient = overRecipient || recipient;
    const activeEnv = overEnv || env;

    setIsGenerating(true);
    setErrorHeader(null);
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini API Key is missing. Please check your environment variables.");
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `
        Create a cinematic storyboard and character visual prompts for a short story about a courier delivering a package to a recipient.
        The story consists of 20 connected scenes. Each scene is 8 seconds (160s total).
        
        MANDATORY REQUIREMENTS:
        1. Character consistency: Provide two detailed visual prompts at the beginning (one for the Courier, one for the Recipient). These prompts must describe their physical appearance, clothing, and overall vibe.
        2. Dialogue Accuracy & Persona: explicitly state who is speaking (e.g., "Kiko: [Dialogue]"). Dialogues MUST be in Indonesian. The Courier must sound like a courier, and the Recipient must sound like the person described in RECIPIENT DETAILS. DO NOT mix up who is speaking.
        3. Language: Use English ONLY for "visualDescription", "courierImagePrompt", and "recipientImagePrompt". Everything else (Story Title, Social Media Titles, Social Media Descriptions, and Dialogues) MUST be in Indonesian.
        4. Narrative Cohesion: The 20 scenes must form a continuous, detailed, logical story arc (Scenes 1-4: Intro/Preparation -> Scenes 5-9: Detailed Journey & obstacles -> Scenes 10-14: Arrival & locating the recipient -> Scenes 15-17: Package Handover & Dialogue -> Scenes 18-19: Recipient opening ${recipient.package} -> Scene 20: Resolution/Conclusion). Each scene MUST logically follow the previous one's spatial and temporal state.
        5. Seamless Transitions: Describe the background and character position changing logically. If moving from a vehicle to a porch, show the vehicle coming to a stop and the courier stepping out. No sudden teleportations or missing actions between scenes.
        6. Consistent Package: The package being delivered must be ${recipient.package}. Its appearance must be described consistently in the visual prompts.
        7. Consistent Identity Instruction: At the end of EVERY scene's "visualDescription", you MUST append the exact sentence: "Keep the same character design, same face, same hairstyle, same outfit, and same body proportions throughout the video. Do not change the character's face, hairstyle, clothing, body shape, or age. No extra people. No costume change. No face distortion."
        8. Spatial Continuity: The ending position/pose of characters in Scene N must match their starting position/pose in Scene N+1. Always describe the movement from point A to point B without skipping steps.
        
        STORYBOARD SCENE GUIDELINES (ULTRA-DETAILED & NON-AMBIGUOUS):
        Each "visualDescription" MUST follow this exact sequence with these specific headers:
        
        [TRANSITION]: [Brief description of how this scene physically connects to the EXACT end state of the previous scene].
        [CHARACTER LOCK]: [Detailed physical appearance of characters involved, derived from character prompts].
        [SCENE ACTION]: [One specific, simple action performed by the characters, ensuring it continues the story flow].
        [BACKGROUND ACTION]: [Specific environment details, textures, and ambient background activity].
        [LIGHTING]: [Precise lighting description (e.g., volumetric, cinematic, golden hour)].
        [CAMERA]: [ONLY ONE simple camera movement (Static, Pan, Tilt, or Follow)].
        [CONSISTENCY RULE]: "Keep the same character design, same face, same hairstyle, same outfit, and same body proportions throughout the video. Do not change the character's face, hairstyle, clothing, body shape, or age. No extra people. No costume change. No face distortion."

        RULES FOR SCENES:
        - NEVER bury character details inside action descriptions.
        - Use ONLY ONE camera movement per 8-second scene.
        - Ensure logical physical continuity between scenes.
        - NO sudden teleportations or costume changes.
        
        SOCIAL MEDIA PROMOTION REQUIREMENTS:
        Based on the generated cinematic storyboard, create social media promotional content for the following platforms using VIRAL STRATEGIES:
        - FACEBOOK REELS: Style: High-Emotion & Relatable. Use psychological hooks like "Gak nyangka banget!", "Pelajaran buat kita semua...", or "Misteri terungkap!". Fields: Viral emotional title, short engaging description, 3-5 hashtags.
        - YOUTUBE SHORTS: Style: Mystery & High-Retention. Use click-driven titles, curiosity gaps, and keywords that trigger the "Must Watch" feeling. Fields: SEO-friendly viral title, short searchable description, 3-4 hashtags.
        - TIKTOK: Style: POV & Trend-Focused. Use high-impact hooks, "POV" style language, and emotional cliffhangers. Fields: Hook-based viral title, engaging short description, 4-5 hashtags.
        
        RULES:
        - All social media titles and descriptions MUST be in Indonesian and use viral keywords.
        - Strategic Framing: Use words that trigger curiosity, emotion, or shock (e.g., "Terbongkar", "Detik-detik", "Bikin Merinding", "Kisah Nyata").
        - Keep platform outputs different in wording.
        - Match all outputs to the cinematic mood of the storyboard.
        - Make titles catchy, spicy, and optimize for high click-through rate (CTR).
        - Do not repeat the same hashtags for every platform.
        - YouTube Shorts hashtags MUST NOT include the '#' symbol and will be joined by commas in the final output.
        - Facebook Reels and TikTok hashtags MUST include the '#' symbol (e.g., #Viral, #Story).
        - Ensure outputs are ready to copy-paste.

        COURIER DETAILS:
        - Name: ${courier.name}
        - Type: ${courier.type}
        - Visual: ${courier.visual}
        - Personality: ${courier.personality}
        - Traits: ${courier.traits}
        - Characteristic: ${courier.characteristic}
        - Vibe: ${courier.vibe}
        - Outfit: ${courier.outfit}
        - Vehicle: ${courier.vehicle}
        
        RECIPIENT DETAILS:
        - Name: ${recipient.name}
        - Type: ${recipient.type}
        - Visual: ${recipient.visual}
        - Personality: ${recipient.personality}
        - Traits: ${recipient.traits}
        - Characteristic: ${recipient.characteristic}
        - Vibe: ${recipient.vibe}
        - Outfit: ${recipient.outfit}
        - Location: ${recipient.location}
        - Package: ${recipient.package}
        - Reaction: ${recipient.reaction}
        
        ENVIRONMENT:
        - Weather: ${env.weather}
        - Atmosphere: ${env.atmosphere}
        - Tone: ${env.tone}
        
        OUTPUT FORMAT:
        Return a JSON object with:
        {
          "title": "A catchy title for the story",
          "storyOverview": "A brief overview or storytelling summary of the entire story in Indonesian. This provides the 'red thread' (benang merah) that connects all scenes.",
          "courierImagePrompt": "A highly detailed image generation prompt for the Courier character",
          "recipientImagePrompt": "A highly detailed image generation prompt for the Recipient character",
          "socialMedia": {
            "facebook": { "title": "...", "description": "...", "hashtags": ["#Tag1", "#Tag2", ...] },
            "youtube": { "title": "...", "description": "...", "hashtags": ["Tag1", "Tag2", ...] },
            "tiktok": { "title": "...", "description": "...", "hashtags": ["#Tag1", "#Tag2", ...] }
          },
          "scenes": [
            {
              "sceneNumber": 1,
              "visualDescription": "...",
              "cameraMovement": "...",
              "sfx": "...",
              "dialogue": "[Speaker Name]: [Dialogue in Indonesian]"
            },
            ... (20 scenes total)
          ]
        }
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              storyOverview: { type: Type.STRING },
              courierImagePrompt: { type: Type.STRING },
              recipientImagePrompt: { type: Type.STRING },
              socialMedia: {
                type: Type.OBJECT,
                properties: {
                  facebook: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      description: { type: Type.STRING },
                      hashtags: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["title", "description", "hashtags"]
                  },
                  youtube: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      description: { type: Type.STRING },
                      hashtags: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["title", "description", "hashtags"]
                  },
                  tiktok: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      description: { type: Type.STRING },
                      hashtags: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["title", "description", "hashtags"]
                  }
                },
                required: ["facebook", "youtube", "tiktok"]
              },
              scenes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sceneNumber: { type: Type.NUMBER },
                    visualDescription: { type: Type.STRING },
                    cameraMovement: { type: Type.STRING },
                    sfx: { type: Type.STRING },
                    dialogue: { type: Type.STRING },
                  },
                  required: ["sceneNumber", "visualDescription", "cameraMovement", "sfx", "dialogue"]
                }
              }
            },
            required: ["title", "courierImagePrompt", "recipientImagePrompt", "socialMedia", "scenes"]
          }
        }
      });

      if (!response.text) {
        throw new Error("No response text received from Gemini.");
      }

      const result = JSON.parse(response.text || "{}");
      setGeneratedPrompt(result);
      return result; // Add return for autopilot usage
    } catch (err: any) {
      console.error("Generation failed:", err);
      setErrorHeader(err.message || "Unknown error occurred during generation.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Remove the auto-regenerate on mount to respect user preference
  // useEffect(() => {
  //   regenerate();
  // }, []);

  const copyToClipboard = () => {
    if (!generatedPrompt) return;
    
    let text = `Veo Cinematic Prompt: ${generatedPrompt.title}\n\n`;
    
    text += `CHARACTER VISUAL PROMPTS:\n`;
    text += `Courier: ${generatedPrompt.courierImagePrompt}\n`;
    text += `Recipient: ${generatedPrompt.recipientImagePrompt}\n\n`;

    text += `STORY OVERVIEW (BENANG MERAH):\n`;
    text += `${generatedPrompt.storyOverview}\n\n`;

    generatedPrompt.scenes.forEach(s => {
      text += `SCENE ${s.sceneNumber}\n`;
      text += `Visual: ${s.visualDescription}\n`;
      text += `Camera: ${s.cameraMovement}\n`;
      text += `SFX: ${s.sfx}\n`;
      const formattedDialogue = s.dialogue.split('\n\n')
        .filter(Boolean)
        .map(line => `"${line.trim()}"`)
        .join('\n');
      text += `Dialogue:\n${formattedDialogue}\n\n`;
    });

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copySceneToClipboard = (scene: Scene, idx: number) => {
    let text = `SCENE ${scene.sceneNumber}\n`;
    text += `Visual: ${scene.visualDescription}\n`;
    text += `Camera: ${scene.cameraMovement}\n`;
    text += `SFX: ${scene.sfx}\n`;
    const formattedDialogue = scene.dialogue.split('\n\n')
      .filter(Boolean)
      .map(line => `"${line.trim()}"`)
      .join('\n');
    text += `Dialogue:\n${formattedDialogue}`;

    navigator.clipboard.writeText(text);
    setCopiedSceneIdx(idx);
    setTimeout(() => setCopiedSceneIdx(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#151619] text-[#FFFFFF] font-sans selection:bg-[#FF4444] selection:text-white">
      {/* Header */}
      <header className="border-b border-[#FFFFFF10] bg-[#151619]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FF4444] rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(255,68,68,0.3)]">
              <Film className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Kang Paket-Story</h1>
              <p className="text-[10px] uppercase tracking-widest text-[#8E9299] font-mono">Cinematic Storytelling Engine</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="border-[#FFFFFF15] bg-[#FFFFFF05] text-[#8E9299] font-mono text-[9px] hidden lg:flex items-center gap-2 px-3 py-1">
              <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
              {jakartaTime} WIB
            </Badge>
            <Badge variant="outline" className="border-[#FFFFFF20] text-[#8E9299] font-mono text-[10px]">
              V3.1 PRO
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Inputs */}
        <div className="lg:col-span-5 space-y-6">
          <Tabs defaultValue="courier" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-[#25262b] border border-[#FFFFFF20] p-1 h-12">
              <TabsTrigger 
                value="courier" 
                className="text-[#FFFFFF60] data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-lg transition-all"
              >
                <Truck className="w-4 h-4 mr-2" /> Courier
              </TabsTrigger>
              <TabsTrigger 
                value="recipient" 
                className="text-[#FFFFFF60] data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-lg transition-all"
              >
                <User className="w-4 h-4 mr-2" /> Recipient
              </TabsTrigger>
              <TabsTrigger 
                value="env" 
                className="text-[#FFFFFF60] data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-lg transition-all"
              >
                <Cloud className="w-4 h-4 mr-2" /> World
              </TabsTrigger>
            </TabsList>

            {/* Courier Tab */}
            <TabsContent value="courier" className="mt-4 space-y-4">
              <Card className="bg-[#25262b] border-[#FFFFFF15] text-white shadow-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-mono text-[#8E9299] uppercase tracking-wider flex items-center gap-2">
                    <Truck className="w-4 h-4" /> Courier Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-[#8E9299]">Name</Label>
                    <Input 
                      value={courier.name} 
                      onChange={e => setCourier({...courier, name: e.target.value})}
                      className="bg-[#151619] border-[#FFFFFF10] focus:border-[#FF4444] transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-[#8E9299]">Type</Label>
                    <Input 
                      value={courier.type} 
                      onChange={e => setCourier({...courier, type: e.target.value})}
                      className="bg-[#151619] border-[#FFFFFF10] focus:border-[#FF4444]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-[#8E9299]">Visual Description</Label>
                    <Input 
                      value={courier.visual} 
                      onChange={e => setCourier({...courier, visual: e.target.value})}
                      className="bg-[#151619] border-[#FFFFFF10] focus:border-[#FF4444]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-[#8E9299]">Personality</Label>
                    <Input 
                      value={courier.personality} 
                      onChange={e => setCourier({...courier, personality: e.target.value})}
                      className="bg-[#151619] border-[#FFFFFF10] focus:border-[#FF4444]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-[#8E9299]">Traits</Label>
                    <Input 
                      value={courier.traits} 
                      onChange={e => setCourier({...courier, traits: e.target.value})}
                      className="bg-[#151619] border-[#FFFFFF10] focus:border-[#FF4444]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-[#8E9299]">Characteristic</Label>
                    <Input 
                      value={courier.characteristic} 
                      onChange={e => setCourier({...courier, characteristic: e.target.value})}
                      className="bg-[#151619] border-[#FFFFFF10] focus:border-[#FF4444]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-[#8E9299]">Vibe</Label>
                    <Input 
                      value={courier.vibe} 
                      onChange={e => setCourier({...courier, vibe: e.target.value})}
                      className="bg-[#151619] border-[#FFFFFF10] focus:border-[#FF4444]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-[#8E9299]">Outfit</Label>
                    <Input 
                      value={courier.outfit} 
                      onChange={e => setCourier({...courier, outfit: e.target.value})}
                      className="bg-[#151619] border-[#FFFFFF10] focus:border-[#FF4444]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-[#8E9299]">Vehicle</Label>
                    <Input 
                      value={courier.vehicle} 
                      onChange={e => setCourier({...courier, vehicle: e.target.value})}
                      className="bg-[#151619] border-[#FFFFFF10] focus:border-[#FF4444]"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Recipient Tab */}
            <TabsContent value="recipient" className="mt-4 space-y-4">
              <Card className="bg-[#25262b] border-[#FFFFFF15] text-white shadow-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-mono text-[#8E9299] uppercase tracking-wider flex items-center gap-2">
                    <User className="w-4 h-4" /> Recipient Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-[#8E9299]">Name</Label>
                    <Input 
                      value={recipient.name} 
                      onChange={e => setRecipient({...recipient, name: e.target.value})}
                      className="bg-[#151619] border-[#FFFFFF10] focus:border-[#FF4444]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-[#8E9299]">Type</Label>
                    <Input 
                      value={recipient.type} 
                      onChange={e => setRecipient({...recipient, type: e.target.value})}
                      className="bg-[#151619] border-[#FFFFFF10] focus:border-[#FF4444]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-[#8E9299]">Visual Description</Label>
                    <Input 
                      value={recipient.visual} 
                      onChange={e => setRecipient({...recipient, visual: e.target.value})}
                      className="bg-[#151619] border-[#FFFFFF10] focus:border-[#FF4444]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-[#8E9299]">Personality</Label>
                    <Input 
                      value={recipient.personality} 
                      onChange={e => setRecipient({...recipient, personality: e.target.value})}
                      className="bg-[#151619] border-[#FFFFFF10] focus:border-[#FF4444]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-[#8E9299]">Traits</Label>
                    <Input 
                      value={recipient.traits} 
                      onChange={e => setRecipient({...recipient, traits: e.target.value})}
                      className="bg-[#151619] border-[#FFFFFF10] focus:border-[#FF4444]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-[#8E9299]">Characteristic</Label>
                    <Input 
                      value={recipient.characteristic} 
                      onChange={e => setRecipient({...recipient, characteristic: e.target.value})}
                      className="bg-[#151619] border-[#FFFFFF10] focus:border-[#FF4444]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-[#8E9299]">Vibe</Label>
                    <Input 
                      value={recipient.vibe} 
                      onChange={e => setRecipient({...recipient, vibe: e.target.value})}
                      className="bg-[#151619] border-[#FFFFFF10] focus:border-[#FF4444]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-[#8E9299]">Outfit</Label>
                    <Input 
                      value={recipient.outfit} 
                      onChange={e => setRecipient({...recipient, outfit: e.target.value})}
                      className="bg-[#151619] border-[#FFFFFF10] focus:border-[#FF4444]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-[#8E9299]">Location</Label>
                    <Input 
                      value={recipient.location} 
                      onChange={e => setRecipient({...recipient, location: e.target.value})}
                      className="bg-[#151619] border-[#FFFFFF10] focus:border-[#FF4444]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-[#8E9299]">Package</Label>
                    <Input 
                      value={recipient.package} 
                      onChange={e => setRecipient({...recipient, package: e.target.value})}
                      className="bg-[#151619] border-[#FFFFFF10] focus:border-[#FF4444]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-[#8E9299]">Reaction</Label>
                    <Input 
                      value={recipient.reaction} 
                      onChange={e => setRecipient({...recipient, reaction: e.target.value})}
                      className="bg-[#151619] border-[#FFFFFF10] focus:border-[#FF4444]"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Environment Tab */}
            <TabsContent value="env" className="mt-4 space-y-4">
              <Card className="bg-[#25262b] border-[#FFFFFF15] text-white shadow-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-mono text-[#8E9299] uppercase tracking-wider flex items-center gap-2">
                    <Cloud className="w-4 h-4" /> Environment Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-[#8E9299]">Weather</Label>
                    <Input 
                      value={env.weather} 
                      onChange={e => setEnv({...env, weather: e.target.value})}
                      className="bg-[#151619] border-[#FFFFFF10] focus:border-[#FF4444]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-[#8E9299]">Atmosphere</Label>
                    <Input 
                      value={env.atmosphere} 
                      onChange={e => setEnv({...env, atmosphere: e.target.value})}
                      className="bg-[#151619] border-[#FFFFFF10] focus:border-[#FF4444]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-[#8E9299]">Tone Example</Label>
                    <Textarea 
                      value={env.tone} 
                      onChange={e => setEnv({...env, tone: e.target.value})}
                      className="bg-[#151619] border-[#FFFFFF10] focus:border-[#FF4444] min-h-[100px]"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Button 
            onClick={regenerate} 
            disabled={isGenerating}
            className="w-full h-14 bg-[#FF4444] hover:bg-[#FF3333] text-white font-bold text-lg shadow-[0_0_30px_rgba(255,68,68,0.2)] transition-all active:scale-[0.98]"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                Wait...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Regenerate
              </>
            )}
          </Button>

          {/* Autopilot Section */}
          <div className="mt-8 pt-6 border-t border-[#FFFFFF10] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-500" />
                <h3 className="text-xs font-bold tracking-widest text-[#8E9299] uppercase">Autopilot Control</h3>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setCourier(DEFAULT_COURIER);
                    setRecipient(DEFAULT_RECIPIENT);
                    setEnv(DEFAULT_ENV);
                  }}
                  className="text-[#8E9299] hover:text-white hover:bg-[#FFFFFF08] text-[10px] font-mono uppercase tracking-widest h-9"
                >
                  <RefreshCw className="w-3 h-3 mr-2" /> Reset Defaults
                </Button>
                <Button 
                  variant={isAutopilotActive ? "destructive" : "default"}
                  size="sm"
                  onClick={() => setIsAutopilotActive(!isAutopilotActive)}
                  className={`text-[10px] font-mono uppercase tracking-widest px-6 h-9 ${!isAutopilotActive ? 'bg-orange-600 hover:bg-orange-500 border-none' : ''}`}
                >
                  {isAutopilotActive ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Stop Autopilot</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" /> Start Autopilot</>
                  )}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {isAutopilotActive && (
                <div className="bg-orange-600/5 border border-orange-500/20 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-orange-500/10 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                      <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">Sistem Autopilot Aktif</span>
                    </div>
                    <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/20 text-[10px] font-mono">
                      {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    {[
                      { id: 1, label: "Fetch Data", match: ["Mencari antrian...", "Data terisi"] },
                      { id: 2, label: "Verification", match: ["Menyiapkan proses", "periksa data"] },
                      { id: 3, label: "Generation", match: ["Sedang men-generate", "Generating"] },
                      { id: 4, label: "Correction", match: ["Hasil siap", "Silakan koreksi"] },
                      { id: 5, label: "Upload", match: ["Mengirim hasil", "Upload results"] },
                      { id: 6, label: "Cooldown", match: ["Menunggu 3 menit", "Tidak ada antrian", "Mencari antrian berikutnya", "Selesai!"] }
                    ].map((step) => {
                      const isActive = step.match.some(m => autopilotStatus.includes(m));
                      return (
                        <div key={step.id} className={`flex items-center gap-3 transition-all ${isActive ? 'opacity-100 scale-105' : 'opacity-40'}`}>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border ${isActive ? 'bg-orange-600 border-orange-500 text-white shadow-[0_0_10px_rgba(234,88,12,0.3)]' : 'bg-black/20 border-orange-500/20 text-orange-500/50'}`}>
                            {isActive && countdown > 0 ? countdown : step.id}
                          </div>
                          <div className="flex-1">
                            <p className={`text-[10px] uppercase tracking-widest font-bold ${isActive ? 'text-orange-500' : 'text-[#8E9299]'}`}>
                              {step.label}
                            </p>
                            {isActive && (
                              <p className="text-[9px] text-orange-200/80 font-mono italic animate-pulse">
                                {autopilotStatus}
                              </p>
                            )}
                          </div>
                          {isActive && (
                            <div className="flex gap-1">
                              {[1, 2, 3].map(i => (
                                <div key={i} className="w-1 h-3 bg-orange-500/30 rounded-full overflow-hidden">
                                  <div className="w-full h-full bg-orange-500 animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-2">
                    <div className="h-1 w-full bg-orange-500/10 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-orange-500"
                        initial={{ width: "0%" }}
                        animate={{ width: countdown > 0 ? `${(countdown / 180) * 100}%` : "100%" }}
                        transition={{ duration: 1 }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Output */}
        <div className="lg:col-span-7">
          <Card className="bg-[#1c1d21] border-[#FFFFFF10] text-white h-full flex flex-col overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b border-[#FFFFFF08] py-4">
              <div>
                <CardTitle className="text-sm font-mono text-[#8E9299] uppercase tracking-wider">
                  Storyboard Output
                </CardTitle>
                {generatedPrompt && (
                  <CardDescription className="text-[#FFFFFF] font-bold mt-1">
                    {generatedPrompt.title}
                  </CardDescription>
                )}
              </div>
              {generatedPrompt && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={copyToClipboard}
                  className="border-[#FFFFFF20] hover:bg-[#FFFFFF08] text-[#8E9299] hover:text-white"
                >
                  {copied ? <Check className="w-4 h-4 mr-2 text-green-500" /> : <Copy className="w-4 h-4 mr-2" />}
                  {copied ? "COPIED" : "COPY FULL PROMPT"}
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <ScrollArea className="h-[1200px] p-6">
                <AnimatePresence mode="wait">
                  {errorHeader ? (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="h-full flex flex-col items-center justify-center text-center space-y-4 py-20"
                    >
                      <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20">
                        <RefreshCw className="w-8 h-8 text-red-500" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-lg font-medium text-red-500">Generation Failed</h3>
                        <p className="text-sm text-[#8E9299] max-w-xs">{errorHeader}</p>
                        <Button 
                          variant="link" 
                          onClick={regenerate}
                          className="text-[#FF4444] hover:text-[#FF3333]"
                        >
                          Try Again
                        </Button>
                      </div>
                    </motion.div>
                  ) : !generatedPrompt && !isGenerating ? (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="h-full flex flex-col items-center justify-center text-center space-y-4 py-20"
                    >
                      <div className="w-16 h-16 bg-[#FFFFFF05] rounded-full flex items-center justify-center border border-[#FFFFFF10]">
                        <Film className="w-8 h-8 text-[#8E9299]" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-lg font-medium text-[#8E9299]">No Story Generated Yet</h3>
                        <p className="text-sm text-[#555] max-w-xs">Configure your characters and environment, then hit generate to create an 8-scene cinematic prompt.</p>
                      </div>
                    </motion.div>
                  ) : isGenerating ? (
                    <div className="space-y-6">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="animate-pulse space-y-3">
                          <div className="h-4 bg-[#FFFFFF08] rounded w-1/4" />
                          <div className="h-24 bg-[#FFFFFF08] rounded w-full" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {/* Character Consistency Section */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-[#1e293b] rounded-xl border border-blue-500/20 p-6 shadow-2xl relative overflow-hidden group"
                      >
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                          <Sparkles className="w-20 h-20 text-blue-400" />
                        </div>
                        
                        <div className="flex items-center gap-2 mb-6">
                          <div className="p-2 bg-blue-500/20 rounded-lg border border-blue-500/30">
                            <Sparkles className="w-5 h-5 text-blue-400" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold tracking-wider text-blue-100 uppercase">Character Consistency Prompts</h3>
                            <p className="text-[10px] text-blue-400 font-mono">Nano Banana Image Generation</p>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase font-mono text-blue-300 tracking-widest">Courier Design Prompt</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (generatedPrompt) {
                                    navigator.clipboard.writeText(generatedPrompt.courierImagePrompt);
                                    setCopiedSceneIdx(-1);
                                    setTimeout(() => setCopiedSceneIdx(null), 2000);
                                  }
                                }}
                                className="w-8 h-8 text-blue-400 bg-blue-500/10 border border-blue-500/20 hover:text-white hover:bg-blue-500/30 hover:border-blue-500/40 transition-all active:scale-90"
                              >
                                {copiedSceneIdx === -1 ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                              </Button>
                            </div>
                            <div 
                              onClick={() => {
                                if (generatedPrompt) {
                                  navigator.clipboard.writeText(generatedPrompt.courierImagePrompt);
                                  setCopiedSceneIdx(-1);
                                  setTimeout(() => setCopiedSceneIdx(null), 2000);
                                }
                              }}
                              className="bg-[#0f172a] p-4 rounded-lg border border-blue-500/10 text-sm italic text-blue-50/80 leading-relaxed cursor-pointer hover:border-blue-500/30 hover:bg-[#0f172a]/80 transition-all relative group/box"
                            >
                              {generatedPrompt.courierImagePrompt}
                              {copiedSceneIdx === -1 && (
                                <div className="absolute top-2 right-2 bg-green-500 text-white text-[10px] px-2 py-0.5 rounded font-bold animate-in fade-in zoom-in">
                                  COPIED
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase font-mono text-blue-300 tracking-widest">Recipient Design Prompt</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (generatedPrompt) {
                                    navigator.clipboard.writeText(generatedPrompt.recipientImagePrompt);
                                    setCopiedSceneIdx(-2);
                                    setTimeout(() => setCopiedSceneIdx(null), 2000);
                                  }
                                }}
                                className="w-8 h-8 text-blue-400 bg-blue-500/10 border border-blue-500/20 hover:text-white hover:bg-blue-500/30 hover:border-blue-500/40 transition-all active:scale-90"
                              >
                                {copiedSceneIdx === -2 ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                              </Button>
                            </div>
                            <div 
                              onClick={() => {
                                if (generatedPrompt) {
                                  navigator.clipboard.writeText(generatedPrompt.recipientImagePrompt);
                                  setCopiedSceneIdx(-2);
                                  setTimeout(() => setCopiedSceneIdx(null), 2000);
                                }
                              }}
                              className="bg-[#0f172a] p-4 rounded-lg border border-blue-500/10 text-sm italic text-blue-50/80 leading-relaxed cursor-pointer hover:border-blue-500/30 hover:bg-[#0f172a]/80 transition-all relative group/box"
                            >
                              {generatedPrompt.recipientImagePrompt}
                              {copiedSceneIdx === -2 && (
                                <div className="absolute top-2 right-2 bg-green-500 text-white text-[10px] px-2 py-0.5 rounded font-bold animate-in fade-in zoom-in">
                                  COPIED
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                      
                      {/* Story Overview / Benang Merah Section */}
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-[#0f172a] rounded-xl border border-teal-500/20 p-6 shadow-2xl relative group z-10"
                      >
                        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                          <BookOpen className="w-16 h-16 text-teal-400" />
                        </div>
                        
                        <div className="flex items-center justify-between mb-4 relative z-20">
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-teal-500/20 rounded-lg border border-teal-500/30">
                              <BookOpen className="w-5 h-5 text-teal-400" />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold tracking-wider text-teal-100 uppercase">Story Overview</h3>
                              <p className="text-[10px] text-teal-400 font-mono tracking-tighter italic">"Benang Merah Cerita"</p>
                            </div>
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={async () => {
                              if (generatedPrompt) {
                                try {
                                  await navigator.clipboard.writeText(generatedPrompt.storyOverview);
                                  setCopiedSceneIdx(-10);
                                  setTimeout(() => setCopiedSceneIdx(null), 2000);
                                } catch (err) {
                                  // Fallback for restricted environments
                                  const textArea = document.createElement("textarea");
                                  textArea.value = generatedPrompt.storyOverview;
                                  document.body.appendChild(textArea);
                                  textArea.select();
                                  try {
                                    document.execCommand('copy');
                                    setCopiedSceneIdx(-10);
                                    setTimeout(() => setCopiedSceneIdx(null), 2000);
                                  } catch (e2) {}
                                  document.body.removeChild(textArea);
                                }
                              }
                            }}
                            className="w-8 h-8 text-teal-400 hover:text-white hover:bg-teal-500/20"
                          >
                            {copiedSceneIdx === -10 ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                          </Button>
                        </div>
                        
                        <div className="relative group/text">
                          <div className="absolute -left-3 top-0 h-full w-1 bg-gradient-to-b from-teal-500/50 to-transparent rounded-full opacity-0 group-hover/text:opacity-100 transition-opacity" />
                          <p className="text-sm text-teal-50/90 leading-relaxed font-serif italic">
                            {generatedPrompt.storyOverview}
                          </p>
                        </div>
                      </motion.div>

                      {generatedPrompt?.scenes.map((scene, idx) => (
                        <motion.div 
                          key={idx}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="group"
                        >
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 bg-[#FF444420] text-[#FF4444] rounded flex items-center justify-center font-mono font-bold text-sm border border-[#FF444430]">
                              {scene.sceneNumber}
                            </div>
                            <Separator className="flex-1 bg-[#FFFFFF08]" />
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono text-[10px] border-[#FFFFFF10] text-[#8E9299]">
                                8 SECONDS
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => copySceneToClipboard(scene, idx)}
                                className="w-8 h-8 text-[#8E9299] hover:text-white hover:bg-[#FFFFFF08]"
                                title="Copy Scene Prompt"
                              >
                                {copiedSceneIdx === idx ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#8E9299] font-mono">
                                  <Package className="w-3 h-3" /> Visual Action
                                </div>
                                <p className="text-sm leading-relaxed text-[#E0E0E0] whitespace-pre-wrap">
                                  {scene.visualDescription}
                                </p>
                              </div>
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#8E9299] font-mono">
                                  <Camera className="w-3 h-3" /> Camera Movement
                                </div>
                                <p className="text-xs text-[#8E9299] italic">
                                  {scene.cameraMovement}
                                </p>
                              </div>
                            </div>

                            <div className="space-y-4 bg-[#FFFFFF03] p-4 rounded-lg border border-[#FFFFFF05]">
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#8E9299] font-mono">
                                  <Volume2 className="w-3 h-3" /> Audio / SFX
                                </div>
                                <p className="text-xs text-[#8E9299]">
                                  {scene.sfx}
                                </p>
                              </div>
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#FF4444] font-mono">
                                  <MessageSquare className="w-3 h-3" /> Dialogue (ID)
                                </div>
                                <div className="space-y-2">
                                  {scene.dialogue.split('\n\n').filter(Boolean).map((line, i) => (
                                    <p key={i} className="text-sm font-medium text-white italic whitespace-pre-wrap">
                                      "{line.trim()}"
                                    </p>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}

                      {/* Social Media Section */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-[#3b0764] rounded-xl border border-purple-500/20 p-6 shadow-2xl relative overflow-hidden group"
                      >
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                          <Send className="w-20 h-20 text-purple-400" />
                        </div>
                        
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-purple-500/20 rounded-lg border border-purple-500/30">
                              <Send className="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold tracking-wider text-purple-100 uppercase">Social Media Promotion</h3>
                              <p className="text-[10px] text-purple-400 font-mono">Platform Optimized Content</p>
                            </div>
                          </div>
                          
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (generatedPrompt) {
                                try {
                                  // Individual components for the single row
                                  // FB: One column (AH), then two empty columns (AI, AJ)
                                  const fbHashtags = generatedPrompt.socialMedia.facebook.hashtags.map(h => h.startsWith('#') ? h : '#' + h).join(' ');
                                  const fbContent = `"${generatedPrompt.socialMedia.facebook.title}\n\n${generatedPrompt.socialMedia.facebook.description}\n\n${fbHashtags}"`;
                                  const fb = `${fbContent}\t\t`;
                                  const ytHashtags = generatedPrompt.socialMedia.youtube.hashtags.map(h => h.replace(/^#/, '')).join(',');
                                  const yt = `${generatedPrompt.socialMedia.youtube.title}\t${generatedPrompt.socialMedia.youtube.description}\t${ytHashtags}`;
                                  
                                  const ttHashtags = generatedPrompt.socialMedia.tiktok.hashtags.map(h => h.startsWith('#') ? h : '#' + h).join(' ');
                                  const ttContent = `"${generatedPrompt.socialMedia.tiktok.title}\n\n${generatedPrompt.socialMedia.tiktok.description}\n\n${ttHashtags}"`;
                                  const tt = `${ttContent}\t\t`; 
                                  
                                  // Join all with tabs
                                  const singleRowData = `${fb}\t${yt}\t${tt}`;
                                  
                                  await navigator.clipboard.writeText(singleRowData);
                                  setCopiedSceneIdx(-6);
                                  setTimeout(() => setCopiedSceneIdx(null), 2000);
                                  } catch (err) {
                                    console.error("Copy failed", err);
                                    const textArea = document.createElement("textarea");
                                    const fbHashtags = generatedPrompt.socialMedia.facebook.hashtags.map(h => h.startsWith('#') ? h : '#' + h).join(' ');
                                    const fbContent = `"${generatedPrompt.socialMedia.facebook.title}\n\n${generatedPrompt.socialMedia.facebook.description}\n\n${fbHashtags}"`;
                                    const fb = `${fbContent}\t\t`;
                                    const ytHashtags = generatedPrompt.socialMedia.youtube.hashtags.map(h => h.replace(/^#/, '')).join(',');
                                    const yt = `${generatedPrompt.socialMedia.youtube.title}\t${generatedPrompt.socialMedia.youtube.description}\t${ytHashtags}`;
                                    
                                    const ttHashtags = generatedPrompt.socialMedia.tiktok.hashtags.map(h => h.startsWith('#') ? h : '#' + h).join(' ');
                                    const ttContent = `"${generatedPrompt.socialMedia.tiktok.title}\n\n${generatedPrompt.socialMedia.tiktok.description}\n\n${ttHashtags}"`;
                                    const tt = `${ttContent}\t\t`;
                                    
                                    textArea.value = `${fb}\t${yt}\t${tt}`;
                                  document.body.appendChild(textArea);
                                  textArea.select();
                                  try {
                                    document.execCommand('copy');
                                    setCopiedSceneIdx(-6);
                                    setTimeout(() => setCopiedSceneIdx(null), 2000);
                                  } catch (e2) {}
                                  document.body.removeChild(textArea);
                                }
                              }
                            }}
                            className="bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20 transition-all gap-2 px-4 h-9 font-bold relative overflow-hidden group/btn"
                          >
                            {copiedSceneIdx === -6 ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                            <span className="text-[10px] uppercase font-bold tracking-wider">Copy All</span>
                          </Button>
                        </div>

                        <div className="space-y-6">
                          {[
                            { id: 'facebook', label: 'Facebook Reels', data: generatedPrompt.socialMedia.facebook, bg: 'bg-[#0f172a]' },
                            { id: 'youtube', label: 'YouTube Shorts', data: generatedPrompt.socialMedia.youtube, bg: 'bg-[#1e1b4b]' },
                            { id: 'tiktok', label: 'TikTok', data: generatedPrompt.socialMedia.tiktok, bg: 'bg-[#000000]' }
                          ].map((plat, idx) => (
                            <div key={plat.id} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase font-mono text-purple-300 tracking-widest">{plat.label}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    const hashtagSeparator = plat.id === 'youtube' ? ',' : ' ';
                                    const cleanedHashtags = plat.data.hashtags.map(h => {
                                      if (plat.id === 'youtube') return h.replace(/^#/, '');
                                      return h.startsWith('#') ? h : '#' + h;
                                    }).join(hashtagSeparator);
                                    
                                    let sheetText;
                                    if (plat.id === 'facebook' || plat.id === 'tiktok') {
                                      sheetText = `"${plat.data.title}\n\n${plat.data.description}\n\n${cleanedHashtags}"`;
                                    } else {
                                      sheetText = `${plat.data.title}\t${plat.data.description}\t${cleanedHashtags}`;
                                    }
                                    
                                    navigator.clipboard.writeText(sheetText);
                                    setCopiedSceneIdx(-3 - idx);
                                    setTimeout(() => setCopiedSceneIdx(null), 2000);
                                  }}
                                  className="w-8 h-8 text-purple-400 hover:text-white hover:bg-purple-500/20 transition-all active:scale-90"
                                  title="Copy Row for Spreadsheet (Tab Separated)"
                                >
                                  {copiedSceneIdx === (-3 - idx) ? <Check className="w-4 h-4 text-green-500" /> : <Table className="w-4 h-4" />}
                                </Button>
                              </div>
                              <div 
                                onClick={() => {
                                  const hashtagSeparator = plat.id === 'youtube' ? ',' : ' ';
                                  const cleanedHashtags = plat.data.hashtags.map(h => {
                                    if (plat.id === 'youtube') return h.replace(/^#/, '');
                                    return h.startsWith('#') ? h : '#' + h;
                                  }).join(hashtagSeparator);
                                  
                                  let sheetText;
                                  if (plat.id === 'facebook' || plat.id === 'tiktok') {
                                    sheetText = `"${plat.data.title}\n\n${plat.data.description}\n\n${cleanedHashtags}"`;
                                  } else {
                                    sheetText = `${plat.data.title}\t${plat.data.description}\t${cleanedHashtags}`;
                                  }
                                  
                                  navigator.clipboard.writeText(sheetText);
                                  setCopiedSceneIdx(-3 - idx);
                                  setTimeout(() => setCopiedSceneIdx(null), 2000);
                                }}
                                className={`${plat.bg} p-4 rounded-lg border border-purple-500/10 text-sm cursor-pointer hover:border-purple-500/30 transition-all relative group/box`}
                              >
                                {plat.id === 'facebook' || plat.id === 'tiktok' ? (
                                  <div className="space-y-4">
                                    <div className="space-y-1">
                                      <p className="font-bold text-white text-base">{plat.data.title}</p>
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-[#E0E0E0] text-sm leading-relaxed">{plat.data.description}</p>
                                    </div>
                                    <div className="space-y-1">
                                      <div className="flex flex-wrap gap-2">
                                        {plat.data.hashtags.map(h => (
                                          <span key={h} className="text-sm font-mono text-purple-300">
                                            {h.startsWith('#') ? h : '#' + h}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                                    <div className="md:col-span-3 space-y-1">
                                      <span className="text-[10px] text-purple-400 font-mono block">TITLE</span>
                                      <p className="font-bold text-white text-sm">{plat.data.title}</p>
                                    </div>
                                    <div className="md:col-span-6 space-y-1">
                                      <span className="text-[10px] text-purple-400 font-mono block">DESCRIPTION</span>
                                      <p className="text-[#E0E0E0] text-[11px] leading-relaxed line-clamp-4 group-hover/box:line-clamp-none transition-all">{plat.data.description}</p>
                                    </div>
                                    <div className="md:col-span-3 space-y-1">
                                      <span className="text-[10px] text-purple-400 font-mono block">HASHTAGS</span>
                                      <div className="flex flex-wrap gap-1">
                                        {plat.data.hashtags.map(h => (
                                          <span key={h} className="text-[10px] font-mono text-purple-300">
                                            {plat.id === 'youtube' ? h.replace(/^#/, '') : (h.startsWith('#') ? h : '#' + h)}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}
                                {copiedSceneIdx === (-3 - idx) && (
                                  <div className="absolute top-2 right-2 bg-green-500 text-white text-[10px] px-2 py-0.5 rounded font-bold animate-in fade-in zoom-in">
                                    COPIED
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#FFFFFF08] py-6 mt-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[10px] font-mono text-[#555] uppercase tracking-widest">
            Built for Google Veo • AI-Powered Cinematic Prompting
          </p>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-mono text-[#8E9299] uppercase tracking-widest">System Ready</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
