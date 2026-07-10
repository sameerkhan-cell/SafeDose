import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cpu, Send, X, ArrowRight, MessageSquare, AlertCircle, Sparkles, User, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ease, DURATION } from "@/lib/motion";

export interface MedicineContext {
  name: string;
  manufacturer: string;
  batchNumber: string;
  expiry: string;
  status: string;
  category?: string;
  activeIngredients?: string;
  genericName?: string;
  approvalStatus?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface MedicineAIChatProps {
  medicineContext: MedicineContext;
  authToken?: string;
}

const SUGGESTED_QUESTIONS = [
  "Side effects kya hain?",
  "Ye kis liye use hoti hai?",
  "Formula/ingredients kya hain?",
  "Kya ye safe hai?",
  "Agar fake nikli to kya karun?",
];

export function MedicineAIChat({ medicineContext, authToken }: MedicineAIChatProps) {
  const { session } = useAuth();
  const token = authToken || session?.token;

  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputVal, setInputVal] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom as new content streams in
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  // Reset conversation if medicine context changes (i.e. a fresh scan occurs)
  const prevBatchRef = useRef(medicineContext.batchNumber);
  useEffect(() => {
    if (prevBatchRef.current !== medicineContext.batchNumber) {
      setMessages([]);
      setInputVal("");
      setErrorMsg(null);
      setShowSuggestions(true);
      prevBatchRef.current = medicineContext.batchNumber;
    }
  }, [medicineContext.batchNumber]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isGenerating) return;

    setErrorMsg(null);
    setShowSuggestions(false);
    setIsGenerating(true);

    const newHistory = [...messages];
    const userMessage: ChatMessage = { role: "user", content: text };
    
    // Add user message to state
    setMessages((prev) => [...prev, userMessage]);
    setInputVal("");

    try {
      // Limit to last 10 messages for history
      const historyPayload = newHistory.slice(-10);

      const response = await fetch("/api/ai/medicine-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: text,
          history: historyPayload,
          medicineContext,
        }),
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.message || "Failed to start AI chat session.");
      }

      if (!response.body) {
        throw new Error("No response stream available.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let accumulatedText = "";

      // Initialize assistant placeholder message
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          
          // Detect mid-stream error sentinel from the server
          if (chunk.includes("\n\n[ERROR]:")) {
            const parts = chunk.split("\n\n[ERROR]:");
            accumulatedText += parts[0];
            const midStreamError = parts[1]?.trim() || "Stream interrupted.";
            
            setErrorMsg(midStreamError);
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.role === "assistant") {
                last.content = accumulatedText + `\n\n*(Error: ${midStreamError})*`;
              }
              return next;
            });
            break;
          }

          accumulatedText += chunk;
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === "assistant") {
              last.content = accumulatedText;
            }
            return next;
          });
        }
      }
    } catch (err: any) {
      console.error("[AI_CHAT_ERROR]", err);
      const msg = err.message || "AI assistant is temporarily unavailable, please try again.";
      setErrorMsg(msg);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ **Error:** ${msg}` },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="w-full mt-4">
      <AnimatePresence mode="wait">
        {!isExpanded ? (
          // Floating Ask AI Pill State
          <motion.div
            key="collapsed-pill"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: DURATION.fast, ease }}
          >
            <button
              onClick={() => setIsExpanded(true)}
              className="w-full flex items-center justify-between p-4 rounded-2xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all duration-300 group shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center border border-primary/20 shrink-0">
                  <Cpu className="h-5 w-5 text-primary animate-pulse" />
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-primary">MediVerify AI</p>
                  <p className="text-[13px] font-bold text-foreground">Ask AI about this medicine</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-primary text-[12px] font-semibold">
                <span>Start Chat</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </div>
            </button>
          </motion.div>
        ) : (
          // Expanded Chat Panel State
          <motion.div
            key="expanded-panel"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: DURATION.normal, ease }}
            className="rounded-2xl border border-border/60 bg-card shadow-elegant overflow-hidden flex flex-col h-[450px]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 bg-secondary/10 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Cpu className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h4 className="text-[13px] font-bold text-foreground">MediVerify AI Assistant</h4>
                  <p className="text-[10px] text-muted-foreground font-medium">Answering contextually for {medicineContext.name}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-8 h-8 p-0 rounded-full hover:bg-secondary/40"
                onClick={() => setIsExpanded(false)}
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>

            {/* Message Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0 scrollbar-thin">
              {messages.length === 0 && (
                <div className="text-center py-6 space-y-2">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto border border-primary/20">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <h5 className="text-[14px] font-bold text-foreground">Ask any question</h5>
                  <p className="text-[12px] text-muted-foreground max-w-xs mx-auto">
                    Get information about usage, side effects, active ingredients or reporting channels.
                  </p>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 max-w-[85%] ${
                    msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[11px] border ${
                      msg.role === "user"
                        ? "bg-secondary text-foreground border-border/50"
                        : "bg-primary/10 text-primary border-primary/20"
                    }`}
                  >
                    {msg.role === "user" ? <User className="h-3.5 w-3.5" /> : <Cpu className="h-3.5 w-3.5" />}
                  </div>
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground font-medium"
                        : "bg-secondary/40 text-foreground border border-border/30"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content || "..."}</p>
                  </div>
                </div>
              ))}

              {isGenerating && messages[messages.length - 1]?.content === "" && (
                <div className="flex gap-3 max-w-[85%] mr-auto items-center">
                  <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center bg-primary/10 text-primary border border-primary/20">
                    <Cpu className="h-3.5 w-3.5" />
                  </div>
                  <div className="bg-secondary/40 rounded-2xl px-4 py-2.5 border border-border/30 flex items-center gap-1">
                    <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
                    <span className="text-[12px] text-muted-foreground font-medium">MediVerify is thinking...</span>
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="p-3.5 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive text-[12px] font-medium flex items-start gap-2 max-w-[85%] mr-auto">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>{errorMsg}</div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Inputs / Suggestions */}
            <div className="p-4 border-t border-border/40 bg-secondary/5 shrink-0 space-y-3">
              {showSuggestions && messages.length === 0 && (
                <div className="flex flex-wrap gap-1.5 max-h-[70px] overflow-y-auto">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      className="text-[11px] font-semibold bg-card border border-border/60 hover:border-primary/40 hover:bg-secondary/30 transition-all rounded-full px-3 py-1.5 text-foreground/80 hover:text-foreground shrink-0 cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend(inputVal);
                }}
                className="flex gap-2"
              >
                <Input
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  placeholder="Type a message or choose a suggestion..."
                  disabled={isGenerating}
                  className="flex-1 h-10 rounded-xl text-[13px] bg-card border-border/60"
                />
                <Button
                  type="submit"
                  disabled={isGenerating || !inputVal.trim()}
                  className="h-10 w-10 p-0 rounded-xl bg-gradient-primary shrink-0 transition-transform duration-200 active:scale-95"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                  ) : (
                    <Send className="h-4 w-4 text-white" />
                  )}
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
