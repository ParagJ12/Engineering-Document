import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileText, ArrowRight, CheckCircle2, Loader2, Copy, Download, MessageSquare, Send, User, Bot, Sparkles, Settings, Cpu, FlaskConical } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { analyzeDocument, generateRoleSummary, chatWithDocument, DocumentAnalysis } from '@/services/ai';
import Markdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
// @ts-ignore
import html2pdf from 'html2pdf.js';

const ROLES = [
  { id: 'engineer', label: 'Engineering Lead', description: 'Technical Specification like Architecture, Components, Constraints.' },
  { id: 'pm', label: 'Product Manager', description: 'Product Requirements Document PRD with User Stories and Goals.' },
  { id: 'investor', label: 'Investor / Leadership', description: 'Executive Summary & Risk Analysis (ROI, Market, Cost).' },
  { id: 'operations', label: 'Operations Manager', description: 'Manufacturing & Supply Chain Plan (BOM, Logistics).' },
];

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationResult, setTranslationResult] = useState<string>('');
  
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model', content: string }[]>([]);
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setAnalysis(null);
    setTranslationResult('');
    setSelectedRole('');
    setChatHistory([]);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = (reader.result as string).split(',')[1];
        setFileData(base64String);
        
        setIsAnalyzing(true);
        try {
          const result = await analyzeDocument(base64String, selectedFile.type, selectedFile.name);
          setAnalysis(result);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to analyze document.');
        } finally {
          setIsAnalyzing(false);
        }
      };
      reader.readAsDataURL(selectedFile);
    } catch (err) {
      setError('Failed to read file.');
    }
  };

  const handleTranslate = async () => {
    if (!fileData || !file || !selectedRole) return;

    setIsTranslating(true);
    setTranslationResult('');
    setError(null);

    try {
      const roleObj = ROLES.find(r => r.id === selectedRole);
      if (!roleObj) return;

      const result = await generateRoleSummary(fileData, file.type, file.name, roleObj.label, roleObj.description, (chunk) => {
        setTranslationResult(chunk);
      });
      setTranslationResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate summary.');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !fileData || !file) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    
    // Capture the current history before adding the new messages
    const currentHistory = [...chatHistory];
    
    setChatHistory(prev => [...prev, { role: 'user', content: userMsg }, { role: 'model', content: '' }]);
    setIsChatting(true);

    try {
      let currentResponse = '';
      await chatWithDocument(fileData, file.type, file.name, currentHistory, userMsg, (chunk) => {
        currentResponse = chunk;
        setChatHistory(prev => {
          const newHistory = [...prev];
          newHistory[newHistory.length - 1].content = currentResponse;
          return newHistory;
        });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat failed.');
      // Remove the empty model message if it failed
      setChatHistory(prev => prev.slice(0, -1));
    } finally {
      setIsChatting(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(translationResult);
  };

  const downloadPDF = async () => {
    const element = document.getElementById('summary-content');
    if (!element) return;
    
    // Create a hidden iframe to render the PDF without Tailwind's oklch colors
    const iframe = document.createElement('iframe');
    iframe.style.visibility = 'hidden';
    iframe.style.position = 'absolute';
    iframe.style.width = '800px';
    iframe.style.height = '1000px';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) {
      document.body.removeChild(iframe);
      return;
    }

    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; line-height: 1.6; padding: 20px; }
            h1, h2, h3 { color: #111; margin-top: 1.5em; margin-bottom: 0.5em; }
            h1 { font-size: 24px; }
            h2 { font-size: 20px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
            h3 { font-size: 16px; }
            p { margin-bottom: 1em; }
            ul, ol { margin-bottom: 1em; padding-left: 2em; }
            li { margin-bottom: 0.5em; }
            code { font-family: monospace; background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
            pre { background: #f4f4f4; padding: 1em; overflow-x: auto; border-radius: 5px; }
            pre code { background: transparent; padding: 0; }
            blockquote { border-left: 4px solid #ccc; margin: 0; padding-left: 1em; color: #666; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 1em; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f9f9f9; }
          </style>
        </head>
        <body>
          ${element.innerHTML}
        </body>
      </html>
    `);
    iframeDoc.close();
    
    const roleObj = ROLES.find(r => r.id === selectedRole);
    const filename = `Techneer_${roleObj?.label.replace(/[^a-zA-Z0-9]/g, '_') || 'Summary'}.pdf`;

    const opt = {
      margin:       0.5,
      filename:     filename,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'in' as const, format: 'letter', orientation: 'portrait' as const }
    };

    try {
      await html2pdf().set(opt).from(iframeDoc.body).save();
    } catch (err) {
      console.error("PDF generation failed", err);
    } finally {
      document.body.removeChild(iframe);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-slate-900 to-emerald-950 font-sans text-zinc-100 selection:bg-emerald-500/30 relative overflow-hidden">
    <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.15),transparent_70%)]" />
      
      {/* Background Animations */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Floating Gear 1 */}
        <motion.div
          animate={{ y: [0, -30, 0], rotate: [0, 90, 180, 270, 360] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute top-32 left-[10%] text-emerald-500/15"
        >
          <Settings size={160} />
        </motion.div>
        
        {/* Floating Circuit */}
        <motion.div
          animate={{ y: [0, 40, 0], x: [0, -20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[40%] right-[15%] text-emerald-500/15"
        >
          <Cpu size={200} />
        </motion.div>
        
        {/* Floating Flask */}
        <motion.div
          animate={{ y: [0, -40, 0], rotate: [-10, 10, -10] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-1/4 left-[20%] text-emerald-500/15"
        >
          <FlaskConical size={140} />
        </motion.div>

        {/* Floating Gear 2 */}
        <motion.div
          animate={{ y: [0, 50, 0], rotate: [0, -180, -360] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-20 right-[25%] text-emerald-500/15"
        >
          <Settings size={100} />
        </motion.div>
      </div>

      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/80 px-6 py-4 backdrop-blur-md relative">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-zinc-950">
              <ArrowRight className="h-5 w-5" />
            </div>
            <span className="text-xl font-semibold tracking-tight text-zinc-100">Techneer</span>
          </div>
          <nav className="text-sm font-medium text-zinc-400">
            Intelligent Engineering Document Analysis
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12 space-y-8 relative z-10">
        <div className="space-y-2 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-100">
            Understand any technical document.
          </h1>
          <p className="text-lg text-zinc-400">
            Upload engineering files to extract key insights, generate role-specific summaries, and chat with your data.
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-red-950/50 p-4 text-sm text-red-400 border border-red-900/50">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Step 1: Upload */}
          <Card className={cn(
            "bg-zinc-900",
            file ? "border-zinc-800" : "border-dashed border-2 border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors"
          )}>
            <CardContent className="p-8">
              {!file ? (
                <div 
                  className="flex flex-col items-center justify-center space-y-4 text-center cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="rounded-full bg-zinc-800 p-4">
                    <UploadCloud className="h-8 w-8 text-zinc-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-zinc-200">Click to upload or drag and drop</p>
                    <p className="text-xs text-zinc-500">PDF, TXT, Images, or CAD files (.prt, .asm, .drw, .step) (Max 10MB)</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="rounded-full bg-zinc-800 p-3">
                      <FileText className="h-6 w-6 text-zinc-300" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{file.name}</p>
                      <p className="text-xs text-zinc-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => {
                    setFile(null);
                    setFileData(null);
                    setAnalysis(null);
                    setTranslationResult('');
                    setSelectedRole('');
                    setChatHistory([]);
                  }}>
                    Change File
                  </Button>
                </div>
              )}
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".pdf,.txt,image/*,.prt,.asm,.drw,.step,.stp,.iges,.igs,.stl,.csv,.xlsx" 
                onChange={handleFileSelect}
              />
            </CardContent>
          </Card>

          {/* Step 2: Analysis & Insights */}
          <AnimatePresence>
            {(isAnalyzing || analysis) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card className="overflow-hidden border-emerald-900/50 bg-zinc-900 shadow-sm">
                  <CardHeader className="bg-emerald-950/30 pb-4 border-b border-emerald-900/50">
                    <CardTitle className="flex items-center text-lg text-emerald-400">
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-500" />
                          Analyzing Document...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-5 w-5 text-emerald-500" />
                          AI Document Analysis
                        </>
                      )}
                    </CardTitle>
                  </CardHeader>
                  {analysis && (
                    <CardContent className="p-6 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-1 space-y-4">
                          <div>
                            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Document Type</span>
                            <p className="text-base font-medium text-zinc-200 mt-1">{analysis.documentType}</p>
                          </div>
                          <div>
                            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Technical Summary</span>
                            <p className="text-sm text-zinc-400 mt-1 leading-relaxed">{analysis.summary}</p>
                          </div>
                        </div>
                        <div className="md:col-span-2">
                          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Key Insights</span>
                          <ul className="mt-2 space-y-2">
                            {analysis.keyInsights.map((insight, idx) => (
                              <li key={idx} className="flex items-start text-sm text-zinc-300">
                                <span className="mr-2 mt-1 flex h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                                <span className="leading-relaxed">{insight}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step 3: Role Selection */}
          <AnimatePresence>
            {analysis && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-zinc-100">Generate Role-Specific Summary</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {ROLES.map((role) => (
                      <div
                        key={role.id}
                        onClick={() => setSelectedRole(role.id)}
                        className={cn(
                          "cursor-pointer rounded-xl border p-4 transition-all hover:border-zinc-600",
                          selectedRole === role.id 
                            ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500" 
                            : "border-zinc-800 bg-zinc-900"
                        )}
                      >
                        <p className="font-medium text-zinc-200">{role.label}</p>
                        <p className="text-sm text-zinc-500 mt-1">{role.description}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button 
                      size="lg" 
                      onClick={handleTranslate} 
                      disabled={!selectedRole || isTranslating}
                      className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      Generate Summary
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step 4: Translation Result */}
          <AnimatePresence>
            {(isTranslating || translationResult) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="overflow-hidden border-zinc-800 bg-zinc-900 shadow-md">
                  <CardHeader className="border-b border-zinc-800 bg-zinc-900/50 py-4 flex flex-row items-center justify-between">
                    <CardTitle className="text-lg flex items-center text-zinc-100">
                      {isTranslating ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin text-zinc-400" />
                          Generating Summary...
                        </>
                      ) : (
                        `${ROLES.find(r => r.id === selectedRole)?.label} Artifact`
                      )}
                    </CardTitle>
                    {!isTranslating && translationResult && (
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" onClick={copyToClipboard} className="border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white">
                          <Copy className="mr-2 h-4 w-4" />
                          Copy
                        </Button>
                        <Button variant="outline" size="sm" onClick={downloadPDF} className="border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white">
                          <Download className="mr-2 h-4 w-4" />
                          Download PDF
                        </Button>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="p-0">
                    <div id="summary-content" className="prose prose-zinc max-w-none p-8 text-sm leading-relaxed bg-white text-zinc-900 rounded-b-xl">
                      <Markdown>{translationResult}</Markdown>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step 5: Interactive Chat */}
          <AnimatePresence>
            {analysis && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="overflow-hidden border-zinc-800 bg-zinc-900 shadow-sm mt-8">
                  <CardHeader className="border-b border-zinc-800 bg-zinc-900/50 py-4">
                    <CardTitle className="text-lg flex items-center text-zinc-100">
                      <MessageSquare className="mr-2 h-5 w-5 text-emerald-500" />
                      Chat with Document
                    </CardTitle>
                    <CardDescription className="text-zinc-400">Ask specific questions about risks, components, or technical details.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 flex flex-col h-[400px]">
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-950/50">
                      {chatHistory.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-zinc-500 text-sm">
                          Send a message to start chatting with the document.
                        </div>
                      ) : (
                        chatHistory.map((msg, i) => (
                          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${msg.role === 'user' ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-800 text-emerald-500'}`}>
                              {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                            </div>
                            <div className={`rounded-2xl px-4 py-2 text-sm max-w-[85%] ${msg.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-zinc-800 border border-zinc-700 shadow-sm text-zinc-200'}`}>
                              {msg.role === 'model' && msg.content === '' ? (
                                <Loader2 className="h-4 w-4 animate-spin text-zinc-400 my-1" />
                              ) : (
                                <div className="prose prose-sm prose-invert max-w-none">
                                  <Markdown>{msg.content}</Markdown>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                      <div ref={chatEndRef} />
                    </div>
                    <div className="p-4 bg-zinc-900 border-t border-zinc-800">
                      <form onSubmit={handleChatSubmit} className="flex gap-2">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder="Ask a question about the document..."
                          className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          disabled={isChatting}
                        />
                        <Button type="submit" size="icon" disabled={!chatInput.trim() || isChatting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                          <Send className="h-4 w-4" />
                        </Button>
                      </form>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
