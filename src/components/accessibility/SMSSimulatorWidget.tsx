import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Smartphone, MessageCircle, MoreHorizontal, User, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SMSSimulator } from "@/services/verification/sms-simulator";

export function SMSSimulatorWidget() {
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<Array<{ text: string, type: 'user' | 'system', time: string }>>([
        { text: "Welcome to SafeDose SMS. Send 'VERIFY {CODE}' to check medicine authenticity.", type: 'system', time: '12:00 PM' }
    ]);
    const [isTyping, setIsTyping] = useState(false);

    const handleSend = async () => {
        if (!input) return;

        const userMsg = { text: input, type: 'user' as const, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
        setMessages(prev => [...prev, userMsg]);
        setInput("");

        setIsTyping(true);
        const response = await SMSSimulator.processCommand(input);

        setTimeout(() => {
            setIsTyping(false);
            setMessages(prev => [...prev, {
                text: response.message,
                type: 'system',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        }, 1000);
    };

    return (
        <div className="card-premium overflow-hidden flex flex-col h-[400px] border-primary/20 bg-gradient-to-b from-secondary/50 to-background/90 group">
            <div className="px-5 py-4 border-b border-white/5 bg-secondary/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 group-hover:scale-110 transition-transform">
                        <Smartphone className="h-4 w-4" />
                    </div>
                    <div>
                        <h3 className="text-[14px] font-bold tracking-tight">SMS Gateway (8002)</h3>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Offline Access Emulator</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-success/10 border border-success/20">
                    <div className="h-1.5 w-1.5 rounded-full bg-success pulse-dot" />
                    <span className="text-[10px] font-black text-success uppercase">Active</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans no-scrollbar">
                {messages.map((msg, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.95, x: msg.type === 'user' ? 20 : -20 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`max-w-[85%] p-3 rounded-2xl relative ${msg.type === 'user'
                                ? 'bg-primary text-primary-foreground rounded-tr-none shadow-lg'
                                : 'bg-secondary/80 text-foreground border border-white/5 rounded-tl-none'
                            }`}>
                            <p className="text-[12px] leading-relaxed font-medium">{msg.text}</p>
                            <span className={`text-[8px] mt-1 block opacity-40 uppercase font-bold text-right`}>{msg.time}</span>
                        </div>
                    </motion.div>
                ))}
                {isTyping && (
                    <div className="flex justify-start">
                        <div className="bg-secondary/80 p-2 rounded-xl rounded-tl-none">
                            <MoreHorizontal className="h-4 w-4 animate-pulse opacity-50" />
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 bg-secondary/20 border-t border-white/5">
                <div className="flex gap-2 bg-background/50 rounded-2xl p-1.5 border border-white/5 focus-within:border-primary/40 transition-colors">
                    <Input
                        placeholder="VERIFY BATCH-ID"
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        className="border-none focus-visible:ring-0 bg-transparent text-[13px] h-10 font-mono tracking-wider"
                    />
                    <Button onClick={handleSend} size="icon" className="rounded-xl h-10 w-10 shrink-0 shadow-lg">
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
                <div className="mt-3 flex items-center justify-center gap-4">
                    <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest flex items-center gap-1.5 opacity-50 hover:opacity-100 cursor-help transition-opacity">
                        <ShieldCheck className="h-3 w-3" /> Encrypted Transmission
                    </p>
                </div>
            </div>
        </div>
    );
}
