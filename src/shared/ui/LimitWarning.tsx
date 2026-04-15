import { AlertTriangle, X, RefreshCw } from 'lucide-react';
import { clearLimitFlag } from '../lib/limitUtils';

interface LimitWarningProps {
  onClose: () => void;
  onRefresh?: () => void;
}

export function LimitWarning({ onClose, onRefresh }: LimitWarningProps) {
  return (
    <div className="fixed bottom-4 right-4 z-[999999] bg-[#ffffcc] border-2 border-[#ff0000] p-3 max-w-sm shadow-[4px_4px_0_rgba(0,0,0,0.3)]">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-xs font-bold text-red-800 mb-1" style={{ fontFamily: 'Tahoma, sans-serif' }}>
            ⚠️ Данные не обновляются
          </p>
          <p className="text-[10px] text-gray-700 mb-2" style={{ fontFamily: 'Tahoma, sans-serif' }}>
            Превышены лимиты сервера. Показаны сохранённые данные.
          </p>
          <div className="flex gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="flex items-center gap-1 px-2 py-1 bg-[#0054e3] text-white text-[10px] font-bold hover:bg-[#0046c7]"
                style={{ fontFamily: 'Tahoma, sans-serif' }}
              >
                <RefreshCw className="w-3 h-3" />
                Обновить
              </button>
            )}
            <button
              onClick={() => {
                clearLimitFlag();
                onClose();
              }}
              className="px-2 py-1 bg-[#c0c0c0] border border-[#808080] text-[10px] font-bold hover:bg-[#d0d0d0]"
              style={{ fontFamily: 'Tahoma, sans-serif' }}
            >
              Закрыть
            </button>
          </div>
        </div>
        <button
          onClick={() => {
            clearLimitFlag();
            onClose();
          }}
          className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-800 flex-shrink-0"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
