import { useState, useRef } from 'react';
import { Search, Plus, Edit2, Trash2, ChevronLeft, ChevronDown, ChevronUp, List, Grid3X3 } from 'lucide-react';
import { supabase } from '../../shared/lib/supabaseClient';
import { CacheManager } from '../../shared/lib/cache';

interface Task {
  id: string;
  description: string;
  status: 'в работе' | 'провалено' | 'выполнено';
}

interface Character {
  id: string;
  photo: string;
  name: string;
  birthDate: string;
  faction: string;
  rank: string;
  status: string;
  shortInfo: string;
  fullInfo: string;
  notes: string;
  tasks: Task[];
  caseNumber: string;
}

interface DatabaseViewProps {
  activeDatabase: 'main' | 'secret';
  setActiveDatabase: (db: 'main' | 'secret') => void;
  viewMode: 'cards' | 'list';
  setViewMode: (mode: 'cards' | 'list') => void;
  characters: Character[];
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filteredCharacters: Character[];
  selectedCharacter: Character | null;
  setSelectedCharacter: (c: Character | null) => void;
  isEditing: boolean;
  setIsEditing: (v: boolean) => void;
  isCreating: boolean;
  setIsCreating: (v: boolean) => void;
  editForm: Character | null;
  setEditForm: (c: Character | null) => void;
  tasksExpanded: boolean;
  setTasksExpanded: (v: boolean) => void;
  expandedShortInfo: string | null;
  setExpandedShortInfo: (v: string | null) => void;
  playAllSound: () => void;
  playSaveSound: () => void;
  currentLogin: string | null;
  isSecret: boolean;
  photo1InputRef: React.RefObject<HTMLInputElement>;
  handlePhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handlePhotoURL: () => void;
  getTaskPlaceholder: (status: Task['status']) => string;
}

const getStatusDotColor = (status: string) => {
  switch (status) {
    case 'Активен': return 'bg-gray-400';
    case 'Пропал': return 'bg-yellow-500';
    case 'Мертв': return 'bg-black-500';
    case 'В розыске': return 'bg-red-500';
    default: return 'bg-gray-500';
  }
};

export function DatabaseView({
  activeDatabase, setActiveDatabase, viewMode, setViewMode,
  characters, setCharacters, searchQuery, setSearchQuery, filteredCharacters,
  selectedCharacter, setSelectedCharacter, isEditing, setIsEditing,
  isCreating, setIsCreating, editForm, setEditForm,
  tasksExpanded, setTasksExpanded, expandedShortInfo, setExpandedShortInfo,
  playAllSound, playSaveSound, currentLogin, isSecret,
  photo1InputRef, handlePhotoChange, handlePhotoURL, getTaskPlaceholder,
}: DatabaseViewProps) {
  const [editTasksExpanded, setEditTasksExpanded] = useState(false);

  const baseColor = isSecret ? 'red' : 'gray';
  const bgColor = isSecret ? 'bg-[#0a0505]' : 'bg-[#050505]';
  const borderColor = isSecret ? 'border-red-900/30' : 'border-[#2a2a2a]';
  const textColor = isSecret ? 'text-red-400' : 'text-gray-400';
  const textMuted = isSecret ? 'text-red-600' : 'text-gray-500';
  const textLight = isSecret ? 'text-red-300' : 'text-gray-300';
  const inputBg = isSecret ? 'bg-[#0f0a0a] border-red-900/30 placeholder:text-red-800' : 'bg-[#0a0a0a] border-[#2a2a2a] placeholder:text-gray-700';
  const cardBg = isSecret ? 'bg-red-950/20 border-red-900/30 hover:bg-red-900/30 hover:border-red-800/50' : 'bg-[#0a0a0a] border-[#2a2a2a] hover:bg-[#0f0f0f] hover:border-[#3a3a3a]';
  const cardWanted = isSecret ? 'bg-red-900/30 border-red-700 hover:bg-red-800/40' : 'bg-red-900/20 border-red-700 hover:bg-red-900/30';

  const saveCharacter = () => {
    playSaveSound();
    if (!editForm) return;

    if (isCreating) {
      setCharacters(prev => [...prev, editForm]);
      setIsCreating(false);
    } else {
      setCharacters(prev => prev.map(c => c.id === editForm!.id ? editForm! : c));
    }

    const payload = {
      id: editForm.id, photo: editForm.photo || null, name: editForm.name || '',
      birthdate: editForm.birthDate || null, faction: editForm.faction || null,
      rank: editForm.rank || null, status: editForm.status || 'Неизвестен',
      shortinfo: editForm.shortInfo || null, fullinfo: editForm.fullInfo || null,
      notes: editForm.notes || null, casenumber: editForm.caseNumber || null,
      tasks: editForm.tasks || null, author_login: currentLogin || null,
      updated_at: new Date().toISOString(),
    };
    const updated = isCreating ? [...characters, editForm] : characters.map(c => c.id === editForm.id ? editForm : c);
    setCharacters(updated);
    const cacheKey = isSecret ? 'secret_characters' : 'pda_characters';
    CacheManager.set(cacheKey, updated, 10 * 60 * 1000);

    if (supabase) {
      const tableName = isSecret ? 'secret_characters' : 'pda_characters';
      supabase.from(tableName).upsert(payload, { onConflict: 'id' }).then(({ error }) => {
        if (error) {
          console.error('Failed to upsert:', error);
          setCharacters(characters);
          CacheManager.set(cacheKey, characters, 10 * 60 * 1000);
        }
      });
    }

    setIsEditing(false);
    setEditForm(null);
    setTasksExpanded(false);
    setEditTasksExpanded(false);
  };

  const deleteCharacter = (id: string) => {
    playAllSound();
    if (confirm('Удалить персонажа?')) {
      const updated = characters.filter(c => c.id !== id);
      setCharacters(updated);
      const cacheKey = isSecret ? 'secret_characters' : 'pda_characters';
      CacheManager.set(cacheKey, updated, 10 * 60 * 1000);
      if (selectedCharacter?.id === id) setSelectedCharacter(null);
      if (supabase) {
        const tableName = isSecret ? 'secret_characters' : 'pda_characters';
        supabase.from(tableName).delete().eq('id', id).then(({ error }) => {
          if (error) {
            console.error('Failed to delete:', error);
            setCharacters(characters);
            CacheManager.set(cacheKey, characters, 10 * 60 * 1000);
          }
        });
      }
    }
  };

  const addTask = () => {
    playAllSound();
    if (!editForm) return;
    setEditForm({ ...editForm, tasks: [{ id: `task-${Date.now()}`, description: '', status: 'в работе' }, ...editForm.tasks] });
    setEditTasksExpanded(true);
  };

  const updateTask = (taskId: string, updates: Partial<Task>) => {
    if (!editForm) return;
    setEditForm({ ...editForm, tasks: editForm.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t) });
  };

  const deleteTask = (taskId: string) => {
    if (!editForm) return;
    setEditForm({ ...editForm, tasks: editForm.tasks.filter(t => t.id !== taskId) });
  };

  // ===== EDIT MODE =====
  if (isEditing && editForm) {
    return (
      <div className={`flex-1 flex flex-col overflow-hidden ${bgColor}`}>
        <div className={`p-3 border-b ${borderColor} flex items-center justify-between flex-shrink-0`}>
          <button onClick={() => { playAllSound(); setIsEditing(false); setIsCreating(false); setEditForm(null); setTasksExpanded(false); setEditTasksExpanded(false); }} className={`px-2 py-1 ${isSecret ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-[#2a2a2a] border-[#3a3a3a] text-gray-400'} border rounded font-mono text-xs`}>ОТМЕНА</button>
          <button onClick={saveCharacter} className="px-3 py-1 bg-green-900/30 border border-green-800 rounded text-green-400 font-mono text-xs hover:bg-green-900/50">СОХРАНИТЬ</button>
        </div>
        <div className="flex-1 overflow-y-auto pda-scrollbar p-4 space-y-3">
          <div className="flex gap-3 items-center">
            <img src={editForm.photo} className="w-20 h-20 object-cover rounded border-2 border-[#2a2a2a]" alt="" />
            <div className="flex gap-2">
              <button onClick={() => photo1InputRef.current?.click()} className={`px-2 py-1 ${isSecret ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-[#2a2a2a] border-[#3a3a3a] text-gray-400'} border rounded font-mono text-xs`}>ФОТО</button>
              <button onClick={handlePhotoURL} className={`px-2 py-1 ${isSecret ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-[#2a2a2a] border-[#3a3a3a] text-gray-400'} border rounded font-mono text-xs`}>URL</button>
            </div>
          </div>
          <input ref={photo1InputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          <input type="text" placeholder="Имя" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor}`} />
          <input type="text" placeholder="Фракция" value={editForm.faction} onChange={(e) => setEditForm({ ...editForm, faction: e.target.value })} className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor}`} />
          <input type="text" placeholder="Ранг" value={editForm.rank} onChange={(e) => setEditForm({ ...editForm, rank: e.target.value })} className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor}`} />
          <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor}`}>
            <option value="Активен">Активен</option><option value="Пропал">Пропал</option><option value="Мертв">Мертв</option><option value="В розыске">В розыске</option><option value="Неизвестен">Неизвестен</option>
          </select>
          <input type="text" placeholder="Дата рождения" value={editForm.birthDate} onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })} className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor}`} />
          <input type="text" placeholder="Номер дела" value={editForm.caseNumber} onChange={(e) => setEditForm({ ...editForm, caseNumber: e.target.value })} className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor}`} />

          {/* Short Info */}
          <div>
            <div className={`${textMuted} font-mono text-[10px] mb-1`}>КРАТКАЯ ИНФО</div>
            <textarea value={editForm.shortInfo} onChange={(e) => setEditForm({ ...editForm, shortInfo: e.target.value })} placeholder="Рост, вес, телосложение..." className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor} resize-none`} rows={4} />
          </div>

          {/* Full Info */}
          <div>
            <div className={`${textMuted} font-mono text-[10px] mb-1`}>ПОЛНАЯ ИНФО</div>
            <textarea value={editForm.fullInfo} onChange={(e) => setEditForm({ ...editForm, fullInfo: e.target.value })} className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor} resize-none`} rows={6} />
          </div>

          {/* Notes */}
          <div>
            <div className={`${textMuted} font-mono text-[10px] mb-1`}>ЗАМЕТКИ</div>
            <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor} resize-none`} rows={3} />
          </div>

          {/* Tasks */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className={`${textMuted} font-mono text-[10px]`}>ЗАДАЧИ ({editForm.tasks.filter(t => t.status === 'в работе').length} активн.)</span>
              <button onClick={addTask} className={`px-2 py-1 ${isSecret ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-[#2a2a2a] border-[#3a3a3a] text-gray-400'} border rounded font-mono text-xs`}>+ ДОБАВИТЬ</button>
            </div>
            {editForm.tasks.map(t => (
              <div key={t.id} className="flex gap-2 mb-2 items-start">
                <select value={t.status} onChange={(e) => updateTask(t.id, { status: e.target.value as Task['status'] })} className={`p-1 ${inputBg} border rounded font-mono text-[10px] ${textColor}`}>
                  <option value="в работе">В работе</option><option value="провалено">Провалено</option><option value="выполнено">Выполнено</option>
                </select>
                <input type="text" placeholder={getTaskPlaceholder(t.status)} value={t.description} onChange={(e) => updateTask(t.id, { description: e.target.value })} className={`flex-1 p-1 ${inputBg} border rounded font-mono text-[10px] ${textColor} placeholder:opacity-50`} />
                <button onClick={() => deleteTask(t.id)} className={`${isSecret ? 'text-red-600' : 'text-gray-600'} hover:text-red-400`}>✕</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ===== DETAIL VIEW =====
  if (selectedCharacter) {
    const activeTasks = selectedCharacter.tasks.filter(t => t.status === 'в работе');
    const completedTasks = selectedCharacter.tasks.filter(t => t.status !== 'в работе');
    return (
      <div className={`flex-1 flex flex-col overflow-hidden ${bgColor}`}>
        <div className={`p-3 border-b ${borderColor} flex items-center justify-between flex-shrink-0`}>
          <button onClick={() => { playAllSound(); setSelectedCharacter(null); }} className={`px-2 py-1 ${isSecret ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-[#2a2a2a] border-[#3a3a3a] text-gray-400'} border rounded font-mono text-xs flex items-center gap-1`}>
            <ChevronLeft className="w-3 h-3" /> Назад
          </button>
          <div className="flex gap-2">
            <button onClick={() => { playAllSound(); setEditForm({ ...selectedCharacter }); setIsEditing(true); }} className={`px-2 py-1 ${isSecret ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-[#2a2a2a] border-[#3a3a3a] text-gray-400'} border rounded font-mono text-xs flex items-center gap-1`}>
              <Edit2 className="w-3 h-3" /> РЕД.
            </button>
            <button onClick={() => deleteCharacter(selectedCharacter.id)} className={`px-2 py-1 ${isSecret ? 'bg-red-900/50 border-red-700 text-red-400' : 'bg-red-900/30 border-red-800 text-red-400'} border rounded font-mono text-xs flex items-center gap-1`}>
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto pda-scrollbar p-4">
          {/* Header */}
          <div className="flex gap-4 mb-4">
            <img src={selectedCharacter.photo} className="w-24 h-24 object-cover rounded border-2 border-[#2a2a2a]" alt="" />
            <div>
              <h2 className={`${textLight} font-mono text-lg font-bold`}>{selectedCharacter.name || 'Без имени'}</h2>
              <div className={`${textMuted} font-mono text-xs`}>{selectedCharacter.faction} • {selectedCharacter.rank}</div>
              <div className={`${textMuted} font-mono text-xs mt-1 flex items-center gap-2`}>
                <div className={`w-2 h-2 rounded-full ${getStatusDotColor(selectedCharacter.status)}`}></div>
                {selectedCharacter.status}
              </div>
              {selectedCharacter.caseNumber && <div className={`${textMuted} font-mono text-xs`}>Дело: {selectedCharacter.caseNumber}</div>}
              {selectedCharacter.birthDate && <div className={`${textMuted} font-mono text-xs`}>Дата рождения: {selectedCharacter.birthDate}</div>}
            </div>
          </div>

          {/* Short Info */}
          {selectedCharacter.shortInfo && (
            <div className="mb-3">
              <button onClick={() => setExpandedShortInfo(expandedShortInfo === selectedCharacter.id ? null : selectedCharacter.id)} className={`${textMuted} font-mono text-[10px] mb-1 flex items-center gap-1`}>
                {expandedShortInfo === selectedCharacter.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} КРАТКАЯ ИНФО
              </button>
              {(expandedShortInfo === selectedCharacter.id) && <pre className={`${textColor} font-mono text-xs whitespace-pre-wrap mt-1 p-2 ${isSecret ? 'bg-red-950/30 border-red-900/30' : 'bg-[#0a0a0a] border-[#2a2a2a]'} border rounded`}>{selectedCharacter.shortInfo}</pre>}
            </div>
          )}

          {/* Full Info */}
          {selectedCharacter.fullInfo && (
            <div className="mb-3">
              <div className={`${textMuted} font-mono text-[10px] mb-1`}>ПОЛНАЯ ИНФО</div>
              <pre className={`${textColor} font-mono text-xs whitespace-pre-wrap p-2 ${isSecret ? 'bg-red-950/30 border-red-900/30' : 'bg-[#0a0a0a] border-[#2a2a2a]'} border rounded`}>{selectedCharacter.fullInfo}</pre>
            </div>
          )}

          {/* Notes */}
          {selectedCharacter.notes && (
            <div className="mb-3">
              <div className={`${textMuted} font-mono text-[10px] mb-1`}>ЗАМЕТКИ</div>
              <pre className={`${textColor} font-mono text-xs whitespace-pre-wrap p-2 ${isSecret ? 'bg-red-950/30 border-red-900/30' : 'bg-[#0a0a0a] border-[#2a2a2a]'} border rounded`}>{selectedCharacter.notes}</pre>
            </div>
          )}

          {/* Tasks */}
          {selectedCharacter.tasks.length > 0 && (
            <div>
              <div className={`${textMuted} font-mono text-[10px] mb-2`}>ЗАДАЧИ ({activeTasks.length} активн.)</div>
              {activeTasks.map(t => (
                <div key={t.id} className={`p-2 mb-1 rounded border text-xs font-mono ${isSecret ? 'border-yellow-600/30 bg-yellow-600/10 text-yellow-400' : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400'}`}>
                  {t.description || <span className="opacity-50">Нет описания</span>}
                </div>
              ))}
              {completedTasks.length > 0 && tasksExpanded && (
                <div className="mt-2">
                  <div className={`${textMuted} font-mono text-[10px] mb-1`}>Завершённые</div>
                  {completedTasks.map(t => (
                    <div key={t.id} className={`p-2 mb-1 rounded border text-xs font-mono ${t.status === 'провалено' ? (isSecret ? 'border-red-600/30 bg-red-600/10 text-red-400' : 'border-red-600/30 bg-red-600/10 text-red-400') : (isSecret ? 'border-gray-600/30 bg-gray-600/10 text-gray-400' : 'border-gray-600/30 bg-gray-600/10 text-gray-400')}`}>
                      {t.description || <span className="opacity-50">Нет описания</span>}
                    </div>
                  ))}
                </div>
              )}
              {completedTasks.length > 0 && !tasksExpanded && (
                <button onClick={() => setTasksExpanded(true)} className={`${textMuted} font-mono text-[10px] mt-1`}>Показать завершённые ({completedTasks.length})</button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===== LIST VIEW (cards or compact) =====
  return (
    <div className={`flex-1 flex flex-col overflow-hidden ${bgColor}`}>
      {/* Toolbar */}
      <div className={`p-3 border-b ${borderColor} flex items-center gap-2 flex-shrink-0`}>
        <Search className={`w-4 h-4 ${isSecret ? 'text-red-700' : 'text-gray-600'}`} />
        <input
          type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск... (введи 'задача' для поиска)"
          className={`flex-1 bg-transparent border-none font-mono text-xs ${textColor} placeholder:opacity-40 focus:outline-none`}
        />
        {/* АБД/БД toggle — только admin */}
        <button
          onClick={() => { playAllSound(); setActiveDatabase(activeDatabase === 'main' ? 'secret' : 'main'); setSearchQuery(''); setSelectedCharacter(null); }}
          className={`px-2 py-1 ${isSecret ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-[#2a2a2a] border-[#3a3a3a] text-gray-400'} border rounded font-mono text-xs hover:opacity-80`}
        >
          {isSecret ? 'АБД' : 'БД'}
        </button>
        {/* View mode toggle */}
        <button
          onClick={() => setViewMode(viewMode === 'cards' ? 'list' : 'cards')}
          className={`p-1.5 ${isSecret ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-[#2a2a2a] border-[#3a3a3a] text-gray-400'} border rounded hover:opacity-80`}
        >
          {viewMode === 'cards' ? <List className="w-3.5 h-3.5" /> : <Grid3X3 className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={() => { playAllSound(); setIsCreating(true); setIsEditing(true); setEditForm({ id: `char-${Date.now()}`, photo: '/icons/nodata.png', name: '', birthDate: '', faction: '', rank: '', status: 'Неизвестен', shortInfo: '', fullInfo: '', notes: '', tasks: [], caseNumber: '' }); setTasksExpanded(false); }}
          className={`px-2 py-1 ${isSecret ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-[#2a2a2a] border-[#3a3a3a] text-gray-400'} border rounded font-mono text-xs flex items-center gap-1`}
        >
          <Plus className="w-3 h-3" /> СОЗДАТЬ
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pda-scrollbar p-3">
        {viewMode === 'cards' ? (
          /* ===== CARDS VIEW ===== */
          <div className="grid grid-cols-2 gap-3">
            {filteredCharacters.map(char => (
              <div
                key={char.id}
                className={`p-3 border cursor-pointer transition-all rounded flex flex-col gap-2 relative ${char.status === 'В розыске' ? cardWanted : cardBg}`}
                onClick={() => { playAllSound(); setSelectedCharacter(char); }}
              >
                {char.tasks.some(t => t.status === 'в работе') && (
                  <div className="absolute top-2 right-2 z-10">
                    <div className={`text-[9px] font-mono px-2 py-1 rounded border ${isSecret ? 'border-yellow-600/50 text-yellow-500 bg-yellow-600/20' : 'border-yellow-500 text-yellow-400 bg-yellow-500/20'} flex items-center gap-1`}>
                      <span>задача</span>
                    </div>
                  </div>
                )}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 relative">
                    <img src={char.photo} alt={char.name} className="w-20 h-28 object-cover rounded border border-[#2a2a2a]" />
                    <div className="absolute top-1 left-0 right-0 flex justify-center">
                      <div className="flex items-center gap-1 px-2 py-1 rounded bg-black/70">
                        <div className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(char.status)}`}></div>
                        <span className="text-gray-300 font-mono text-[9px]">{char.status}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className={`${textLight} font-mono text-lg mb-1 truncate`}>{char.name}</div>
                    <div className={`${textColor} font-mono text-base mb-0 truncate`}>{char.faction}</div>
                    <div className={`${textMuted} font-mono text-xs mb-3 truncate`}>{char.rank}</div>
                    {char.shortInfo && (
                      <div className={`${textMuted} font-mono text-[10px] line-clamp-3 whitespace-pre-wrap`}>{char.shortInfo}</div>
                    )}
                    {char.tasks.some(t => t.status === 'в работе') && (
                      <div className={`mt-1 text-[9px] font-mono ${isSecret ? 'text-yellow-500' : 'text-yellow-400'}`}>
                        {char.tasks.filter(t => t.status === 'в работе').length} зад.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ===== LIST VIEW (compact, Slack-like) ===== */
          <div className="space-y-1">
            {filteredCharacters.map(char => {
              const activeTasks = char.tasks.filter(t => t.status === 'в работе');
              return (
                <div
                  key={char.id}
                  className={`p-2.5 border cursor-pointer transition-all rounded flex items-center gap-3 ${char.status === 'В розыске' ? cardWanted : cardBg}`}
                  onClick={() => { playAllSound(); setSelectedCharacter(char); }}
                >
                  {/* Left: info */}
                  <div className="flex-1 min-w-0">
                    <div className={`${textLight} font-mono text-sm font-bold truncate`}>
                      {char.name || 'Без имени'}
                      {char.status === 'В розыске' && <span className="text-red-500 ml-2 text-xs">[РОЗЫСК]</span>}
                    </div>
                    <div className={`${textMuted} font-mono text-[10px] truncate`}>
                      {char.faction}{char.rank ? ` • ${char.rank}` : ''}
                    </div>
                  </div>
                  {/* Right: case number + status + tasks */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {activeTasks.length > 0 && (
                      <div className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${isSecret ? 'border-yellow-600/50 text-yellow-500 bg-yellow-600/10' : 'border-yellow-500/50 text-yellow-400 bg-yellow-500/10'}`}>
                        {activeTasks.length} зад.
                      </div>
                    )}
                    <div className={`text-[10px] font-mono flex items-center gap-1.5`}>
                      <div className={`w-2 h-2 rounded-full ${getStatusDotColor(char.status)}`}></div>
                      {char.status}
                    </div>
                    {char.caseNumber && (
                      <div className={`${textMuted} font-mono text-[10px]`}>{char.caseNumber}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredCharacters.length === 0 && (
          <div className={`${textMuted} font-mono text-xs text-center py-12`}>
            {searchQuery ? 'Ничего не найдено' : 'Записей пока нет. Создай первую!'}
          </div>
        )}
      </div>
    </div>
  );
}
