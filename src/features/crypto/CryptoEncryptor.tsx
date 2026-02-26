import { useState, useRef } from 'react';
import { Lock, ChevronLeft, Copy, ClipboardPaste, Trash2 } from 'lucide-react';

interface CryptoEncryptorProps {
  onBack: () => void;
  isMuted: boolean;
}

const RUS_UPPER = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ";
const RUS_LOWER = RUS_UPPER.toLowerCase();
const ENG_UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ENG_LOWER = ENG_UPPER.toLowerCase();

export function CryptoEncryptor({ onBack, isMuted }: CryptoEncryptorProps) {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [vigenereKey, setVigenereKey] = useState('KEY');
  const [caesarShift, setCaesarShift] = useState(3);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');

  const allSoundRef = useRef<HTMLAudioElement>(null);

  const playSound = () => {
    if (isMuted) return;
    if (allSoundRef.current) {
      allSoundRef.current.currentTime = 0;
      allSoundRef.current.play().catch(() => {});
    }
  };

  const shiftChar = (char: string, shift: number): string => {
    if (ENG_UPPER.includes(char)) {
      return ENG_UPPER[(ENG_UPPER.indexOf(char) + shift + 26) % 26];
    } else if (ENG_LOWER.includes(char)) {
      return ENG_LOWER[(ENG_LOWER.indexOf(char) + shift + 26) % 26];
    } else if (RUS_UPPER.includes(char)) {
      return RUS_UPPER[(RUS_UPPER.indexOf(char) + shift + 33) % 33];
    } else if (RUS_LOWER.includes(char)) {
      return RUS_LOWER[(RUS_LOWER.indexOf(char) + shift + 33) % 33];
    }
    return char;
  };

  const caesarEncrypt = (text: string, shift: number): string => {
    return text.split('').map(c => shiftChar(c, shift)).join('');
  };

  const caesarDecrypt = (text: string, shift: number): string => {
    return caesarEncrypt(text, -shift);
  };

  const vigenereEncrypt = (text: string, key: string): string => {
    if (!key) return text;
    
    let result = "";
    let keyIndex = 0;

    for (let char of text) {
      if (ENG_UPPER.includes(char) || ENG_LOWER.includes(char)) {
        let keyChar = key[keyIndex % key.length];
        
        if (ENG_UPPER.includes(keyChar.toUpperCase())) {
          let shift = ENG_UPPER.indexOf(keyChar.toUpperCase());
          let alphabet = char === char.toUpperCase() ? ENG_UPPER : ENG_LOWER;
          result += alphabet[(alphabet.indexOf(char) + shift) % 26];
          keyIndex++;
        } else {
          result += char;
        }
      } else if (RUS_UPPER.includes(char) || RUS_LOWER.includes(char)) {
        let keyChar = key[keyIndex % key.length];
        
        if (RUS_UPPER.includes(keyChar.toUpperCase())) {
          let shift = RUS_UPPER.indexOf(keyChar.toUpperCase());
          let alphabet = char === char.toUpperCase() ? RUS_UPPER : RUS_LOWER;
          result += alphabet[(alphabet.indexOf(char) + shift) % 33];
          keyIndex++;
        } else {
          result += char;
        }
      } else {
        result += char;
      }
    }
    return result;
  };

  const vigenereDecrypt = (text: string, key: string): string => {
    if (!key) return text;
    
    let result = "";
    let keyIndex = 0;

    for (let char of text) {
      if (ENG_UPPER.includes(char) || ENG_LOWER.includes(char)) {
        let keyChar = key[keyIndex % key.length];
        
        if (ENG_UPPER.includes(keyChar.toUpperCase())) {
          let shift = ENG_UPPER.indexOf(keyChar.toUpperCase());
          let alphabet = char === char.toUpperCase() ? ENG_UPPER : ENG_LOWER;
          result += alphabet[(alphabet.indexOf(char) - shift + 26) % 26];
          keyIndex++;
        } else {
          result += char;
        }
      } else if (RUS_UPPER.includes(char) || RUS_LOWER.includes(char)) {
        let keyChar = key[keyIndex % key.length];
        
        if (RUS_UPPER.includes(keyChar.toUpperCase())) {
          let shift = RUS_UPPER.indexOf(keyChar.toUpperCase());
          let alphabet = char === char.toUpperCase() ? RUS_UPPER : RUS_LOWER;
          result += alphabet[(alphabet.indexOf(char) - shift + 33) % 33];
          keyIndex++;
        } else {
          result += char;
        }
      } else {
        result += char;
      }
    }
    return result;
  };

  const handleEncrypt = () => {
    playSound();
    
    if (!vigenereKey.match(/^[A-Za-zА-Яа-я]+$/)) {
      alert('Ключ должен содержать только буквы!');
      return;
    }

    const step1 = caesarEncrypt(inputText, caesarShift);
    const final = vigenereEncrypt(step1, vigenereKey);
    setOutputText(final);
  };

  const handleDecrypt = () => {
    playSound();
    
    if (!vigenereKey.match(/^[A-Za-zА-Яа-я]+$/)) {
      alert('Ключ должен содержать только буквы!');
      return;
    }

    const step1 = vigenereDecrypt(inputText, vigenereKey);
    const final = caesarDecrypt(step1, caesarShift);
    setOutputText(final);
  };

  const handleCopy = () => {
    playSound();
    navigator.clipboard.writeText(outputText).then(() => {
      setNotificationMessage('Скопировано!');
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 2000);
    });
  };

  const handlePaste = () => {
    playSound();
    navigator.clipboard.readText().then(text => {
      setInputText(text);
    }).catch(() => {
      alert('Не удалось вставить текст');
    });
  };

  const handleClear = () => {
    playSound();
    setInputText('');
    setOutputText('');
    setVigenereKey('');
    setCaesarShift(3);
  };

  const charCount = inputText.length;
  const outputCount = outputText.length;

  return (
    <>
      <audio ref={allSoundRef} src="/media/sounds/all.mp3" />
      
      <div className="flex-1 flex flex-col overflow-hidden bg-[#050505]">
        {/* Header with back button */}
        <div className="p-3 border-b border-[#2a2a2a] flex-shrink-0">
          <button
            onClick={() => {
              playSound();
              onBack();
            }}
            className="px-3 py-1.5 bg-[#2a2a2a] border border-[#3a3a3a] rounded hover:bg-[#3a3a3a] transition-all flex items-center gap-1 text-gray-400 font-mono text-xs"
          >
            <ChevronLeft className="w-4 h-4" />
            НАЗАД
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pda-scrollbar p-4 space-y-4">
          {/* Title */}
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-5 h-5 text-gray-400" />
            <h2 className="text-gray-300 font-mono text-sm tracking-wider">ШИФРАТОР</h2>
          </div>

          {/* Input */}
          <div>
            <label className="text-gray-400 font-mono text-xs mb-2 block">
              📝 Введите текст:
            </label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Введите текст для шифрования..."
              className="w-full h-32 p-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-gray-300 font-mono text-xs focus:border-[#4a4a4a] focus:outline-none resize-none placeholder:text-gray-700"
            />
          </div>

          {/* Key & Shift */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 font-mono text-xs mb-2 block">
                🔑 Ключ Вижинера:
              </label>
              <input
                type="text"
                value={vigenereKey}
                onChange={(e) => setVigenereKey(e.target.value)}
                placeholder="Только буквы"
                className="w-full p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-gray-300 font-mono text-xs focus:border-[#4a4a4a] focus:outline-none placeholder:text-gray-700"
              />
            </div>
            <div>
              <label className="text-gray-400 font-mono text-xs mb-2 block">
                ⚡ Сдвиг Цезаря:
              </label>
              <input
                type="number"
                value={caesarShift}
                onChange={(e) => setCaesarShift(parseInt(e.target.value) || 0)}
                min="-50"
                max="50"
                className="w-full p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-gray-300 font-mono text-xs focus:border-[#4a4a4a] focus:outline-none"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 justify-center flex-wrap">
            <button
              onClick={handleEncrypt}
              className="px-4 py-2 bg-gradient-to-r from-[#667eea] to-[#764ba2] border border-[#5a67d8] rounded hover:from-[#764ba2] hover:to-[#667eea] transition-all text-white font-mono text-xs flex items-center gap-2"
            >
              <Lock className="w-4 h-4" />
              Зашифровать
            </button>
            <button
              onClick={handleDecrypt}
              className="px-4 py-2 bg-gradient-to-r from-[#667eea] to-[#764ba2] border border-[#5a67d8] rounded hover:from-[#764ba2] hover:to-[#667eea] transition-all text-white font-mono text-xs flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
              Дешифровать
            </button>
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded hover:bg-[#3a3a3a] transition-all text-gray-300 font-mono text-xs flex items-center gap-2"
            >
              <Copy className="w-4 h-4" />
              Копировать
            </button>
            <button
              onClick={handlePaste}
              className="px-4 py-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded hover:bg-[#3a3a3a] transition-all text-gray-300 font-mono text-xs flex items-center gap-2"
            >
              <ClipboardPaste className="w-4 h-4" />
              Вставить
            </button>
            <button
              onClick={handleClear}
              className="px-4 py-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded hover:bg-[#3a3a3a] transition-all text-gray-300 font-mono text-xs flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Очистить
            </button>
          </div>

          {/* Output */}
          <div className="border-t border-[#3a3a3a] pt-4">
            <label className="text-gray-400 font-mono text-xs mb-2 block">
              📊 Результат:
            </label>
            <textarea
              value={outputText}
              readOnly
              placeholder="Результат появится здесь..."
              className="w-full h-32 p-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-gray-300 font-mono text-xs focus:border-[#4a4a4a] focus:outline-none resize-none placeholder:text-gray-700"
            />
          </div>

          {/* Stats */}
          <div className="text-center text-gray-600 font-mono text-xs">
            Символов: ввод - {charCount}, вывод - {outputCount}
          </div>
        </div>

        {/* Notification */}
        {showNotification && (
          <div className="fixed top-5 right-5 z-[100040] bg-green-600 text-white px-4 py-2 rounded border border-green-500 font-mono text-xs animate-pulse">
            {notificationMessage}
          </div>
        )}
      </div>
    </>
  );
}
