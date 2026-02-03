
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BotStatus, LinkData, TelegramUpdate } from './types';
import { TelegramBotService } from './services/telegramBot';
import { 
  Bot, 
  Play, 
  Square, 
  Download, 
  Link as LinkIcon, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  ShieldCheck,
  Globe
} from 'lucide-react';

const App: React.FC = () => {
  const [token, setToken] = useState<string>('');
  const [status, setStatus] = useState<BotStatus>(BotStatus.IDLE);
  const [processedLinks, setProcessedLinks] = useState<LinkData[]>([]);
  const [botInfo, setBotInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const botServiceRef = useRef<TelegramBotService | null>(null);
  const isPollingRef = useRef<boolean>(false);

  const startBot = async () => {
    if (!token) {
      setError("Please enter a valid bot token");
      return;
    }

    try {
      setStatus(BotStatus.STARTING);
      setError(null);
      const service = new TelegramBotService(token);
      const me = await service.getMe();
      
      if (!me.ok) {
        throw new Error(me.description || "Invalid bot token");
      }

      setBotInfo(me.result);
      botServiceRef.current = service;
      setStatus(BotStatus.RUNNING);
      isPollingRef.current = true;
      startPolling();
    } catch (err: any) {
      setError(err.message || "Failed to start bot");
      setStatus(BotStatus.ERROR);
    }
  };

  const stopBot = () => {
    isPollingRef.current = false;
    setStatus(BotStatus.IDLE);
  };

  const processLinksBatch = useCallback(async (updates: TelegramUpdate[]) => {
    if (!botServiceRef.current) return;

    for (const update of updates) {
      // Handle Start Button Callback
      if (update.callback_query) {
        await botServiceRef.current.answerCallbackQuery(
          update.callback_query.id, 
          "Okay, you can you can..."
        );
        continue;
      }

      // Handle Link Filtering
      if (update.message?.text) {
        const text = update.message.text;
        const chatId = update.message.chat.id;
        const messageId = update.message.message_id;

        // Command /start handling
        if (text === '/start') {
          await botServiceRef.current.sendMessage(chatId, "Welcome! Click the button below to start processing links.", {
            inline_keyboard: [[{ text: "Start Processing", callback_data: "start_process" }]]
          });
          continue;
        }

        const rawLinks = TelegramBotService.extractLinks(text);
        if (rawLinks.length > 0) {
          setIsProcessing(true);
          
          const newLinks: LinkData[] = rawLinks.map(l => ({
            ...l,
            timestamp: Date.now()
          }));

          setProcessedLinks(prev => {
            // deduplication across sessions/messages
            const existingUrls = new Set(prev.map(p => p.url.toLowerCase().trim()));
            const uniqueNew = newLinks.filter(nl => !existingUrls.has(nl.url.toLowerCase().trim()));
            return [...prev, ...uniqueNew];
          });

          // Delete the original message to avoid confusion as requested
          try {
            await botServiceRef.current.deleteMessage(chatId, messageId);
          } catch (e) {
            console.warn("Could not delete message (maybe bot lacks permissions?)");
          }

          // Acknowledge processing
          await botServiceRef.current.sendMessage(chatId, `✅ Filtered and stored ${rawLinks.length} links. Original message deleted.`);
          
          setIsProcessing(false);
        }
      }
    }
  }, []);

  const startPolling = async () => {
    while (isPollingRef.current) {
      if (!botServiceRef.current) break;
      try {
        const updates = await botServiceRef.current.getUpdates();
        if (updates.length > 0) {
          await processLinksBatch(updates);
        }
      } catch (err) {
        console.error("Polling error", err);
        // Avoid tight loop on error
        await new Promise(r => setTimeout(r, 2000));
      }
      // Small delay between polls
      await new Promise(r => setTimeout(r, 500));
    }
  };

  const downloadLinks = () => {
    if (processedLinks.length === 0) return;
    
    const content = processedLinks.map(l => `[${l.type.toUpperCase()}] ${l.url}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `filtered_links_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const clearLinks = () => {
    if (window.confirm("Are you sure you want to clear all processed links?")) {
      setProcessedLinks([]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-blue-600 rounded-2xl shadow-lg mb-4">
            <Bot className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Lerb Link Pro</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Securely manage your link filtering bot. Handles thousands of links, 
            categorizes public vs. private, and auto-deletes processed messages.
          </p>
        </div>

        {/* Dashboard Content */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Controls Panel */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Bot Configuration</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="token" className="block text-sm font-medium text-gray-700 mb-1">Telegram Bot Token</label>
                  <input
                    id="token"
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="123456789:ABCDEF..."
                    disabled={status === BotStatus.RUNNING}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>

                {status !== BotStatus.RUNNING ? (
                  <button
                    onClick={startBot}
                    disabled={status === BotStatus.STARTING}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition active:scale-95 disabled:opacity-50"
                  >
                    {status === BotStatus.STARTING ? (
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <Play className="w-5 h-5 fill-current" />
                    )}
                    Start Bot
                  </button>
                ) : (
                  <button
                    onClick={stopBot}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition active:scale-95"
                  >
                    <Square className="w-5 h-5 fill-current" />
                    Stop Bot
                  </button>
                )}

                {error && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Status Panel */}
            {botInfo && (
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Bot Info</h2>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xl">
                    {botInfo.first_name[0]}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">{botInfo.first_name}</div>
                    <div className="text-sm text-gray-500">@{botInfo.username}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 py-2 px-3 bg-green-50 text-green-700 rounded-lg text-xs font-semibold">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  ONLINE & MONITORING
                </div>
              </div>
            )}
          </div>

          {/* Main Display */}
          <div className="md:col-span-2 space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col">
                <span className="text-sm font-medium text-gray-500 mb-1">Public Links</span>
                <span className="text-3xl font-bold text-blue-600">
                  {processedLinks.filter(l => l.type === 'public').length}
                </span>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col">
                <span className="text-sm font-medium text-gray-500 mb-1">Private Links</span>
                <span className="text-3xl font-bold text-purple-600">
                  {processedLinks.filter(l => l.type === 'private').length}
                </span>
              </div>
            </div>

            {/* Links List */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-5 h-5 text-gray-400" />
                  <h2 className="font-bold text-gray-800">Processed Links</h2>
                  <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full font-medium">
                    {processedLinks.length} total
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {processedLinks.length > 0 && (
                    <>
                      <button
                        onClick={clearLinks}
                        className="p-2 text-gray-400 hover:text-red-500 transition rounded-lg hover:bg-gray-50"
                        title="Clear all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={downloadLinks}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition active:scale-95"
                      >
                        <Download className="w-4 h-4" />
                        Download TXT
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              <div className="max-h-[500px] overflow-y-auto">
                {processedLinks.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-gray-300" />
                    </div>
                    <p className="text-gray-400 font-medium">No links processed yet.</p>
                    <p className="text-sm text-gray-400 mt-1">Send links to your bot to see them here.</p>
                  </div>
                ) : (
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold tracking-wider">
                      <tr>
                        <th className="px-6 py-3">Type</th>
                        <th className="px-6 py-3">Link URL</th>
                        <th className="px-6 py-3 text-right">Detected</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {processedLinks.slice().reverse().map((link, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/30 transition group">
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold uppercase ${
                              link.type === 'public' 
                                ? 'bg-blue-100 text-blue-700' 
                                : 'bg-purple-100 text-purple-700'
                            }`}>
                              {link.type === 'public' ? <Globe className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                              {link.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono text-sm text-gray-600 truncate max-w-[200px] md:max-w-xs">
                            {link.url}
                          </td>
                          <td className="px-6 py-4 text-right text-xs text-gray-400">
                            {new Date(link.timestamp).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              
              {isProcessing && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-20">
                  <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
                    <span className="font-bold text-blue-600">Processing batch...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Feature Tags */}
            <div className="flex flex-wrap gap-3 justify-center">
              <span className="flex items-center gap-1 text-xs font-medium text-gray-500 bg-white border border-gray-100 px-3 py-1.5 rounded-full shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Duplicate Removal
              </span>
              <span className="flex items-center gap-1 text-xs font-medium text-gray-500 bg-white border border-gray-100 px-3 py-1.5 rounded-full shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Link Categorization
              </span>
              <span className="flex items-center gap-1 text-xs font-medium text-gray-500 bg-white border border-gray-100 px-3 py-1.5 rounded-full shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Auto-Message Cleanup
              </span>
              <span className="flex items-center gap-1 text-xs font-medium text-gray-500 bg-white border border-gray-100 px-3 py-1.5 rounded-full shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Batch Processing
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="pt-8 pb-4 text-center text-gray-400 text-sm border-t border-gray-200">
          <p>© {new Date().getFullYear()} Lerb Link Pro • Secure Client-Side Link Processor</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
