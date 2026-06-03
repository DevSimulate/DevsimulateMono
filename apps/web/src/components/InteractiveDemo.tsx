"use client";

import { useState } from "react";
import { X, CheckCircle2, XCircle, Lightbulb } from "lucide-react";

const DEMO_TICKET = {
  title: "DEMO-01: User Registration Fails Silently",
  description: `Users are reporting that they click "Sign Up" but nothing happens. 
No error message appears, and the form doesn't submit. The button just stays 
in a loading state forever. This started happening yesterday after a deployment.`,
  
  buggyCode: `async function handleSignUp(email, password) {
  setLoading(true);
  
  const response = await fetch('/api/register', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  
  if (response.ok) {
    router.push('/dashboard');
  }
  
  setLoading(false);
}`,

  fixedCode: `async function handleSignUp(email, password) {
  setLoading(true);
  
  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'  // Missing header!
      },
      body: JSON.stringify({ email, password })
    });
    
    if (response.ok) {
      router.push('/dashboard');
    } else {
      const error = await response.json();
      setError(error.message);  // Show error to user
    }
  } catch (err) {
    setError('Network error. Please try again.');
  } finally {
    setLoading(false);  // Always stop loading
  }
}`,

  rootCause: "Missing Content-Type header causes server to reject request silently",
  
  hints: [
    "Check the network tab - what status code is returned?",
    "What headers are required for JSON requests?",
    "What happens if the fetch fails?",
  ]
};

interface InteractiveDemoProps {
  onClose: () => void;
}

export function InteractiveDemo({ onClose }: InteractiveDemoProps) {
  const [step, setStep] = useState<'ticket' | 'code' | 'diagnosis' | 'result'>('ticket');
  const [userDiagnosis, setUserDiagnosis] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const [score, setScore] = useState<number | null>(null);

  const handleSubmitDiagnosis = () => {
    const diagnosis = userDiagnosis.toLowerCase();
    let calculatedScore = 0;
    
    // Simple scoring logic
    if (diagnosis.includes('header') || diagnosis.includes('content-type')) {
      calculatedScore += 40; // Diagnosis
    }
    if (diagnosis.includes('error') || diagnosis.includes('catch') || diagnosis.includes('try')) {
      calculatedScore += 30; // Design
    }
    if (diagnosis.includes('user') || diagnosis.includes('message')) {
      calculatedScore += 20; // Communication
    }
    if (diagnosis.includes('finally') || diagnosis.includes('loading')) {
      calculatedScore += 10; // Execution
    }
    
    setScore(calculatedScore);
    setStep('result');
  };

  const nextHint = () => {
    if (hintIndex < DEMO_TICKET.hints.length - 1) {
      setHintIndex(hintIndex + 1);
      setShowHint(true);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div>
            <h2 className="text-2xl font-bold text-white">Interactive Demo</h2>
            <p className="text-sm text-slate-400 mt-1">
              Try diagnosing a real bug and get instant AI-style feedback
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 px-6 py-4 bg-slate-950/50">
          {['Ticket', 'Code', 'Diagnosis', 'Result'].map((label, idx) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  ['ticket', 'code', 'diagnosis', 'result'][idx] === step
                    ? 'bg-brand-500 text-white'
                    : idx < ['ticket', 'code', 'diagnosis', 'result'].indexOf(step)
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {label}
              </div>
              {idx < 3 && <div className="w-8 h-0.5 bg-slate-800" />}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {step === 'ticket' && (
            <div className="space-y-6 animate-in slide-in-from-bottom duration-300">
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
                <h3 className="text-xl font-bold text-white mb-3">
                  {DEMO_TICKET.title}
                </h3>
                <p className="text-slate-300 leading-relaxed whitespace-pre-line">
                  {DEMO_TICKET.description}
                </p>
              </div>
              
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 font-semibold">
                  MID
                </span>
                <span>Est. 15 minutes</span>
                <span>•</span>
                <span>Files: <code className="text-brand-400">SignUpForm.tsx</code></span>
              </div>

              <button
                onClick={() => setStep('code')}
                className="w-full rounded-lg bg-brand-500 text-white px-6 py-3 font-semibold hover:bg-brand-600 transition-colors"
              >
                View Code →
              </button>
            </div>
          )}

          {step === 'code' && (
            <div className="space-y-6 animate-in slide-in-from-bottom duration-300">
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">
                  Buggy Code (SignUpForm.tsx)
                </h3>
                <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 overflow-x-auto">
                  <code className="text-sm text-slate-300 font-mono">
                    {DEMO_TICKET.buggyCode}
                  </code>
                </pre>
              </div>

              <div className="rounded-lg border border-brand-500/30 bg-brand-500/10 p-4">
                <div className="flex items-start gap-3">
                  <Lightbulb className="w-5 h-5 text-brand-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-brand-300 font-semibold mb-1">
                      Need a hint?
                    </p>
                    {showHint ? (
                      <p className="text-sm text-slate-300">
                        {DEMO_TICKET.hints[hintIndex]}
                      </p>
                    ) : (
                      <button
                        onClick={() => setShowHint(true)}
                        className="text-sm text-brand-400 hover:text-brand-300 underline"
                      >
                        Show hint
                      </button>
                    )}
                    {showHint && hintIndex < DEMO_TICKET.hints.length - 1 && (
                      <button
                        onClick={nextHint}
                        className="text-sm text-brand-400 hover:text-brand-300 underline ml-4"
                      >
                        Next hint →
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setStep('diagnosis')}
                className="w-full rounded-lg bg-brand-500 text-white px-6 py-3 font-semibold hover:bg-brand-600 transition-colors"
              >
                Diagnose the Bug →
              </button>
            </div>
          )}

          {step === 'diagnosis' && (
            <div className="space-y-6 animate-in slide-in-from-bottom duration-300">
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">
                  What's causing this bug?
                </h3>
                <p className="text-sm text-slate-400 mb-4">
                  Explain the root cause and how you would fix it. Think like a senior engineer:
                  focus on <strong>why</strong> it's broken, not just <strong>what</strong> to change.
                </p>
                <textarea
                  value={userDiagnosis}
                  onChange={(e) => setUserDiagnosis(e.target.value)}
                  placeholder="Example: The root cause is... This happens because... I would fix it by..."
                  className="w-full h-40 bg-slate-950 border border-slate-700 rounded-lg p-4 text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setStep('code')}
                  className="rounded-lg border border-slate-700 text-slate-300 px-6 py-3 font-semibold hover:border-slate-500 transition-colors"
                >
                  ← Back to Code
                </button>
                <button
                  onClick={handleSubmitDiagnosis}
                  disabled={userDiagnosis.length < 20}
                  className="rounded-lg bg-brand-500 text-white px-6 py-3 font-semibold hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit Diagnosis →
                </button>
              </div>
            </div>
          )}

          {step === 'result' && score !== null && (
            <div className="space-y-6 animate-in slide-in-from-bottom duration-300">
              {/* Score */}
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br from-brand-500 to-purple-500 mb-4">
                  <span className="text-5xl font-black text-white">{score}</span>
                </div>
                <p className="text-slate-400 text-sm">out of 100</p>
              </div>

              {/* Feedback */}
              <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-6 space-y-4">
                <h3 className="text-lg font-semibold text-white">AI Feedback</h3>
                
                {score >= 70 ? (
                  <div className="flex items-start gap-3 text-emerald-400">
                    <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold mb-1">Great diagnosis!</p>
                      <p className="text-sm text-slate-300">
                        You correctly identified the missing Content-Type header and the lack of error handling.
                        This is exactly the kind of root cause analysis that distinguishes senior engineers.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 text-amber-400">
                    <XCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold mb-1">Partial diagnosis</p>
                      <p className="text-sm text-slate-300">
                        You identified some issues, but missed the root cause: the missing Content-Type header.
                        Also consider error handling and user feedback.
                      </p>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-800">
                  <p className="text-sm font-semibold text-white mb-2">The Fix:</p>
                  <pre className="bg-slate-900 border border-slate-800 rounded-lg p-4 overflow-x-auto">
                    <code className="text-xs text-slate-300 font-mono">
                      {DEMO_TICKET.fixedCode}
                    </code>
                  </pre>
                </div>

                <div className="pt-4 border-t border-slate-800">
                  <p className="text-sm font-semibold text-white mb-2">Root Cause:</p>
                  <p className="text-sm text-slate-300">{DEMO_TICKET.rootCause}</p>
                </div>
              </div>

              {/* CTA */}
              <div className="rounded-xl border border-brand-500/30 bg-brand-500/10 p-6 text-center">
                <h3 className="text-xl font-bold text-white mb-2">
                  Ready for the real thing?
                </h3>
                <p className="text-slate-300 mb-4">
                  Get access to 200+ realistic tickets across multiple tech stacks.
                  Claude AI scores every dimension of your thinking.
                </p>
                <a
                  href={`https://github.com/login/oauth/authorize?client_id=${process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID}&scope=read:user,user:email,repo`}
                  className="inline-block rounded-lg bg-brand-500 text-white px-8 py-3 font-semibold hover:bg-brand-600 transition-colors"
                >
                  Start for Free
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
