import { useState } from 'react';
import { Send, Bot, User, HelpCircle } from 'lucide-react';
import { Markdown } from '../common/Markdown';

interface Props {
  conversations: Array<{ role: string; content: string }>;
  pendingQuestion?: { questionId: string; question: string } | null;
  onAnswer?: (answer: string) => void;
}

export function ConversationPanel({ conversations, pendingQuestion, onAnswer }: Props) {
  const [answer, setAnswer] = useState('');

  const handleSubmit = () => {
    if (!answer.trim() || !onAnswer) return;
    onAnswer(answer.trim());
    setAnswer('');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto space-y-3 p-4">
        {conversations.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role !== 'user' && (
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600/20 flex items-center justify-center">
                <Bot size={14} className="text-primary-400" />
              </div>
            )}
            <div
              className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                msg.role === 'user'
                  ? 'bg-primary-600/20 text-primary-100'
                  : 'bg-gray-800 text-gray-300'
              }`}
            >
              <Markdown>{msg.content}</Markdown>
            </div>
            {msg.role === 'user' && (
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600/20 flex items-center justify-center">
                <User size={14} className="text-green-400" />
              </div>
            )}
          </div>
        ))}

        {pendingQuestion && (
          <div className="flex gap-2">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-600/20 flex items-center justify-center">
              <HelpCircle size={14} className="text-yellow-400" />
            </div>
            <div className="bg-yellow-900/20 border border-yellow-700/30 px-3 py-2 rounded-lg text-sm text-yellow-200">
              {pendingQuestion.question}
            </div>
          </div>
        )}
      </div>

      {pendingQuestion && (
        <div className="border-t border-gray-800 p-3 flex gap-2">
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="답변을 입력하세요..."
            className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-primary-500"
          />
          <button
            onClick={handleSubmit}
            disabled={!answer.trim()}
            className="p-2 rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-50"
          >
            <Send size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
