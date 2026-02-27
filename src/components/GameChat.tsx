"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface ChatMessage {
  id: string;
  senderId: string; // playerId | opponentId | "system" | "bot"
  senderName: string;
  message: string;
  isPreset: boolean;
  timestamp: number;
  reported: boolean;
}

export interface GameChatProps {
  messages: ChatMessage[];
  onSendMessage: (message: string, isPreset: boolean) => void;
  onReportMessage: (messageId: string) => void;
  playerName: string;
  opponentName: string;
  playerId: string;
  unreadCount: number;
  isOpen: boolean;
  onToggle: () => void;
}

const PRESET_MESSAGES = [
  "👋 GL HF",
  "👏 Nice one!",
  "😅 Close one!",
  "🔥 GG",
  "🤝 Rematch?",
  "😂 LOL",
  "🫡 Respect",
  "⏳ Hold on",
];

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes();
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${m.toString().padStart(2, "0")}`;
}

export default function GameChat({
  messages,
  onSendMessage,
  onReportMessage,
  playerName,
  opponentName,
  playerId,
  unreadCount,
  isOpen,
  onToggle,
}: GameChatProps) {
  const [activeTab, setActiveTab] = useState<"log" | "chat">("chat");
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => a.timestamp - b.timestamp),
    [messages]
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [sortedMessages.length]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || trimmed.length > 200) return;
    onSendMessage(trimmed, false);
    setInput("");
  };

  const desktopPanel = (
    <div className="hidden h-full w-72 flex-col rounded-xl border border-white/10 bg-card/90 p-3 md:flex">
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-white/10 pb-1 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab("log")}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            activeTab === "log"
              ? "bg-white/10 text-white"
              : "text-body-gray hover:text-white"
          }`}
        >
          Game Log
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("chat")}
          className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
            activeTab === "chat"
              ? "bg-white/10 text-white"
              : "text-body-gray hover:text-white"
          }`}
        >
          Chat 💬
          {unreadCount > 0 && (
            <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </div>

      {activeTab === "log" ? (
        <div className="flex flex-1 items-center justify-center text-[11px] text-body-gray">
          <p>Game log is shown in the main game view.</p>
        </div>
      ) : (
        <>
          <div
            ref={scrollRef}
            className="flex-1 space-y-2 overflow-y-auto pr-1 text-[11px]"
          >
            {sortedMessages.length === 0 && (
              <p className="mt-4 text-center text-body-gray">
                No messages yet. Say hi!
              </p>
            )}
            {sortedMessages.map((m) => {
              const isSystem = m.senderId === "system";
              const isMine = m.senderId === playerId;
              if (isSystem) {
                return (
                  <div
                    key={m.id}
                    className="flex justify-center text-[10px] text-body-gray"
                  >
                    <span>{m.message}</span>
                  </div>
                );
              }
              const alignClass = isMine ? "items-end" : "items-start";
              const bubbleClass = isMine
                ? "bg-teal/10 border-l-2 border-teal"
                : "bg-purple/10 border-l-2 border-purple";
              const name = isMine ? playerName : m.senderName || opponentName;
              return (
                <div
                  key={m.id}
                  className={`flex ${alignClass}`}
                >
                  <div className="max-w-[85%]">
                    <div className="mb-0.5 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-body-gray">
                        {name}
                      </span>
                      {!isMine && (
                        <button
                          type="button"
                          onClick={() => onReportMessage(m.id)}
                          className="invisible text-[10px] text-red-400 hover:text-red-300 group-hover:visible md:visible"
                          aria-label="Report message"
                        >
                          ⚠️
                        </button>
                      )}
                    </div>
                    <div
                      className={`group rounded-md px-3 py-2 text-[11px] leading-snug text-white ${bubbleClass} ${
                        m.reported ? "bg-red-500/10 border-red-500/70" : ""
                      }`}
                    >
                      <p>{m.message}</p>
                      <div className="mt-1 flex justify-end text-[9px] text-body-gray">
                        {formatTime(m.timestamp)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Preset pills */}
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1 text-[11px]">
            {PRESET_MESSAGES.map((msg) => (
              <button
                key={msg}
                type="button"
                onClick={() => onSendMessage(msg, true)}
                className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-body-gray transition-transform active:scale-95 hover:border-white/20 hover:text-white"
              >
                {msg}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              maxLength={200}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message..."
              className="h-9 flex-1 rounded-lg border border-white/10 bg-[#1A1D27] px-3 text-[11px] text-white placeholder:text-body-gray focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            />
            <button
              type="button"
              onClick={handleSend}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal text-sm font-semibold text-charcoal hover:shadow-teal-glow disabled:opacity-50"
              disabled={!input.trim()}
            >
              ➤
            </button>
          </div>
        </>
      )}
    </div>
  );

  const mobileBubble = (
    <button
      type="button"
      onClick={onToggle}
      className="fixed bottom-20 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-teal text-xl text-charcoal shadow-lg shadow-teal/40 md:hidden"
      aria-label="Toggle chat"
    >
      💬
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );

  const mobilePanel = !isOpen ? null : (
    <div className="fixed inset-x-0 bottom-0 z-40 flex max-h-[60vh] flex-col rounded-t-2xl border-t border-white/10 bg-card/95 p-3 md:hidden">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-white">
          <span>Chat 💬</span>
          {unreadCount > 0 && (
            <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-full bg-white/5 px-2 py-1 text-[11px] text-body-gray"
        >
          Close
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-2 overflow-y-auto pr-1 text-[11px]"
      >
        {sortedMessages.length === 0 && (
          <p className="mt-4 text-center text-body-gray">
            No messages yet. Say hi!
          </p>
        )}
        {sortedMessages.map((m) => {
          const isSystem = m.senderId === "system";
          const isMine = m.senderId === playerId;
          if (isSystem) {
            return (
              <div
                key={m.id}
                className="flex justify-center text-[10px] text-body-gray"
              >
                <span>{m.message}</span>
              </div>
            );
          }
          const alignClass = isMine ? "items-end" : "items-start";
          const bubbleClass = isMine
            ? "bg-teal/10 border-l-2 border-teal"
            : "bg-purple/10 border-l-2 border-purple";
          const name = isMine ? playerName : m.senderName || opponentName;
          return (
            <div
              key={m.id}
              className={`flex ${alignClass}`}
            >
              <div className="max-w-[85%]">
                <div className="mb-0.5 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-body-gray">
                    {name}
                  </span>
                  {!isMine && (
                    <button
                      type="button"
                      onClick={() => onReportMessage(m.id)}
                      className="text-[10px] text-red-400 hover:text-red-300"
                      aria-label="Report message"
                    >
                      ⚠️
                    </button>
                  )}
                </div>
                <div
                  className={`rounded-md px-3 py-2 text-[11px] leading-snug text-white ${bubbleClass} ${
                    m.reported ? "bg-red-500/10 border-red-500/70" : ""
                  }`}
                >
                  <p>{m.message}</p>
                  <div className="mt-1 flex justify-end text-[9px] text-body-gray">
                    {formatTime(m.timestamp)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex gap-2 overflow-x-auto pb-1 text-[11px]">
        {PRESET_MESSAGES.map((msg) => (
          <button
            key={msg}
            type="button"
            onClick={() => onSendMessage(msg, true)}
            className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-body-gray transition-transform active:scale-95 hover:border-white/20 hover:text-white"
          >
            {msg}
          </button>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <input
          type="text"
          maxLength={200}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type a message..."
          className="h-9 flex-1 rounded-lg border border-white/10 bg-[#1A1D27] px-3 text-[11px] text-white placeholder:text-body-gray focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
        />
        <button
          type="button"
          onClick={handleSend}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal text-sm font-semibold text-charcoal hover:shadow-teal-glow disabled:opacity-50"
          disabled={!input.trim()}
        >
          ➤
        </button>
      </div>
    </div>
  );

  return (
    <>
      {desktopPanel}
      {mobileBubble}
      {mobilePanel}
    </>
  );
}

