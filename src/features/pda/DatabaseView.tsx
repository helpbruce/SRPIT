import { useState, useRef } from 'react';
import { Search, Plus, Edit2, Trash2, ChevronLeft, ChevronDown, ChevronUp, List, Grid3X3, Calendar, Save } from 'lucide-react';
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
  supabase: any;
  isSecret: boolean;
  canAccessAbd: boolean;
  photo1InputRef: React.RefObject<HTMLInputElement>;
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
  playAllSound, playSaveSound, currentLogin, supabase, isSecret, canAccessAbd,
  photo1InputRef, getTaskPlaceholder,
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
          <h2 className={`text-sm font-mono ${textMuted}`}>{isCreating ? 'НОВЫЙ ПЕРСОНАЖ' : 'РЕДАКТИРОВАНИЕ'}</h2>
          <div className="flex gap-2">
            <button onClick={() => { playAllSound(); setIsEditing(false); setIsCreating(false); setEditForm(null); setTasksExpanded(false); }} className={`px-3 py-1.5 ${isSecret ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-[#2a2a2a] border-[#3a3a3a] text-gray-400'} border rounded font-mono text-xs hover:opacity-80 transition-all`}>ОТМЕНА</button>
            <button onClick={saveCharacter} className={`px-3 py-1.5 ${isSecret ? 'bg-green-900/30 border-green-800 text-green-400' : 'bg-gray-700/30 border-gray-600 text-gray-300'} border rounded font-mono text-xs flex items-center gap-1 hover:opacity-80 transition-all`}>
              <Save className="w-4 h-4" /> СОХРАНИТЬ
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pda-scrollbar p-4">
          <div className="flex gap-4">
            {/* Left - Photo */}
            <div className="flex-shrink-0">
              <div className="mb-3">
                <label className={`block ${textMuted} text-[10px] font-mono mb-1 text-center`}>НОМЕР ДЕЛА</label>
                <input type="text" value={editForm.caseNumber} onChange={(e) => setEditForm({ ...editForm, caseNumber: e.target.value })} placeholder="88005553535" className={`w-40 p-2 ${inputBg} border rounded font-mono text-xs ${textColor} focus:outline-none text-center placeholder:opacity-30`} />
              </div>
              <img src={editForm.photo} alt="Preview" className="w-40 h-56 object-cover rounded border border-[#2a2a2a] mb-3" />
              <div className="flex gap-2">
                <button onClick={() => { playAllSound(); photo1InputRef.current?.click(); }} className={`flex-1 px-3 py-1.5 ${isSecret ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-[#2a2a2a] border-[#3a3a3a] text-gray-400'} border rounded font-mono text-[10px] hover:opacity-80 transition-all`}>ФАЙЛ</button>
                <button onClick={() => { const url = prompt('Введите URL фотографии:'); if (url && editForm) setEditForm({ ...editForm, photo: url }); }} className={`flex-1 px-3 py-1.5 ${isSecret ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-[#2a2a2a] border-[#3a3a3a] text-gray-400'} border rounded font-mono text-[10px] hover:opacity-80 transition-all`}>URL</button>
              </div>
              <input ref={photo1InputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file && editForm) { const reader = new FileReader(); reader.onload = (ev) => { if (ev.target?.result) setEditForm({ ...editForm, photo: ev.target.result as string }); }; reader.readAsDataURL(file); } }} />
            </div>

            {/* Right - Fields */}
            <div className="flex-1 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block ${textMuted} text-[10px] font-mono mb-1`}>ИМЯ</label>
                  <input type="text" placeholder="Имя" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor} placeholder:opacity-30`} />
                </div>
                <div>
                  <label className={`block ${textMuted} text-[10px] font-mono mb-1`}>СТАТУС</label>
                  <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor}`}>
                    <option value="Активен">Активен</option><option value="Пропал">Пропал</option><option value="Мертв">Мертв</option><option value="В розыске">В розыске</option><option value="Неизвестен">Неизвестен</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={`block ${textMuted} text-[10px] font-mono mb-1`}>ФРАКЦИЯ</label>
                  <input type="text" placeholder="Фракция" value={editForm.faction} onChange={(e) => setEditForm({ ...editForm, faction: e.target.value })} className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor} placeholder:opacity-30`} />
                </div>
                <div>
                  <label className={`block ${textMuted} text-[10px] font-mono mb-1`}>РАНГ</label>
                  <input type="text" placeholder="Ранг" value={editForm.rank} onChange={(e) => setEditForm({ ...editForm, rank: e.target.value })} className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor} placeholder:opacity-30`} />
                </div>
                <div>
                  <label className={`block ${textMuted} text-[10px] font-mono mb-1`}>ДАТА РОЖДЕНИЯ</label>
                  <input type="text" placeholder="Дата рождения" value={editForm.birthDate} onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })} className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor} placeholder:opacity-30`} />
                </div>
              </div>

              {/* Short Info */}
              <div>
                <label className={`block ${textMuted} text-[10px] font-mono mb-1`}>КРАТКАЯ ИНФО</label>
                <textarea value={editForm.shortInfo} onChange={(e) => setEditForm({ ...editForm, shortInfo: e.target.value })} placeholder="Рост, вес, телосложение..." className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor} resize-none placeholder:opacity-30`} rows={4} />
              </div>

              {/* Full Info */}
              <div>
                <label className={`block ${textMuted} text-[10px] font-mono mb-1`}>ПОЛНАЯ ИНФО</label>
                <textarea value={editForm.fullInfo} onChange={(e) => setEditForm({ ...editForm, fullInfo: e.target.value })} className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor} resize-none placeholder:opacity-30`} rows={6} />
              </div>

              {/* Notes */}
              <div>
                <label className={`block ${textMuted} text-[10px] font-mono mb-1`}>ЗАМЕТКИ</label>
                <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor} resize-none placeholder:opacity-30`} rows={3} />
              </div>

              {/* Tasks */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`${textMuted} font-mono text-[10px]`}>ЗАДАЧИ ({editForm.tasks.filter(t => t.status === 'в работе').length} активн.)</span>
                  <button onClick={() => { playAllSound(); setEditForm({ ...editForm, tasks: [{ id: `task-${Date.now()}`, description: '', status: 'в работе' }, ...editForm.tasks] }); setEditTasksExpanded(true); }} className={`px-2 py-1 ${isSecret ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-[#2a2a2a] border-[#3a3a3a] text-gray-400'} border rounded font-mono text-xs`}>+ ДОБАВИТЬ</button>
                </div>
                {editForm.tasks.map(t => (
                  <div key={t.id} className="flex gap-2 mb-2 items-start">
                    <select value={t.status} onChange={(e) => setEditForm({ ...editForm, tasks: editForm.tasks.map(tk => tk.id === t.id ? { ...tk, status: e.target.value as Task['status'] } : tk) })} className={`p-1 ${inputBg} border rounded font-mono text-[10px] ${textColor}`}>
                      <option value="в работе">В работе</option><option value="провалено">Провалено</option><option value="выполнено">Выполнено</option>
                    </select>
                    <input type="text" placeholder={getTaskPlaceholder(t.status)} value={t.description} onChange={(e) => setEditForm({ ...editForm, tasks: editForm.tasks.map(tk => tk.id === t.id ? { ...tk, description: e.target.value } : tk) })} className={`flex-1 p-1 ${inputBg} border rounded font-mono text-[10px] ${textColor} placeholder:opacity-30`} />
                    <button onClick={() => setEditForm({ ...editForm, tasks: editForm.tasks.filter(tk => tk.id !== t.id) })} className={`${isSecret ? 'text-red-600' : 'text-gray-600'} hover:text-red-400`}>✕</button>
                  </div>
                ))}
              </div>
            </div>
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
        <div className={`p-3 border-b ${borderColor} flex-shrink-0`}>
          <button onClick={() => { playAllSound(); setSelectedCharacter(null); }} className={`px-3 py-1.5 ${isSecret ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-[#2a2a2a] border-[#3a3a3a] text-gray-400'} border rounded font-mono text-xs flex items-center gap-1 hover:opacity-80 transition-all`}>
            <ChevronLeft className="w-4 h-4" /> НАЗАД
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pda-scrollbar p-4">
          <div className="flex gap-5">
            {/* Left column - Photo + buttons */}
            <div className="flex-shrink-0 flex flex-col items-center">
              <div className="flex gap-2 mb-3">
                <button onClick={() => { playAllSound(); setEditForm({ ...selectedCharacter }); setIsEditing(true); }} className={`px-3 py-1.5 ${isSecret ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-[#2a2a2a] border-[#3a3a3a] text-gray-400'} border rounded font-mono text-[10px] flex items-center gap-1 hover:opacity-80 transition-all`}>
                  <Edit2 className="w-3 h-3" /> ИЗМЕНИТЬ
                </button>
                <button onClick={() => deleteCharacter(selectedCharacter.id)} className={`px-3 py-1.5 ${isSecret ? 'bg-red-900/40 border-red-700 text-red-400' : 'bg-red-900/20 border-red-800 text-red-500'} border rounded font-mono text-[10px] hover:opacity-80 transition-all`}>
                  УДАЛИТЬ
                </button>
              </div>

              <div className="relative mb-3">
                <img
                  src={selectedCharacter.photo}
                  alt={selectedCharacter.name}
                  className="w-40 h-56 object-cover rounded border border-[#2a2a2a] shadow-lg"
                />
                <div className="absolute top-0 left-0 right-0 flex justify-center">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/80">
                    <div className={`w-2 h-2 rounded-full ${getStatusDotColor(selectedCharacter.status)} animate-pulse`}></div>
                    <span className="text-gray-300 font-mono text-[10px]">{selectedCharacter.status}</span>
                  </div>
                </div>
              </div>

              <div className="text-center space-y-1.5 mb-3 w-full">
                <div className="flex items-center justify-center gap-1.5">
                  <Calendar className="w-3 h-3 text-gray-600 flex-shrink-0" />
                  <div className="text-gray-400 font-mono text-[11px]">{selectedCharacter.birthDate}</div>
                </div>
                <div className="text-gray-300 font-mono text-sm font-bold">
                  {selectedCharacter.faction}
                </div>
                <div className="text-gray-500 font-mono text-xs">
                  {selectedCharacter.rank}
                </div>
              </div>
            </div>

            {/* Right column - Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-3 border-b border-[#2a2a2a] pb-2">
                <h2 className={`text-lg font-mono break-words flex-1 ${textLight}`}>
                  {selectedCharacter.name || 'Без имени'}
                </h2>
                {selectedCharacter.caseNumber && (
                  <div className="text-gray-400 font-mono text-base ml-3 flex-shrink-0">
                    {selectedCharacter.caseNumber}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {/* Short Info */}
                {selectedCharacter.shortInfo && (
                  <div className={`p-3 ${isSecret ? 'bg-red-950/30 border-red-900/30' : 'bg-[#0a0a0a] border-[#2a2a2a]'} border rounded`}>
                    <div className={`${textMuted} text-[10px] font-mono mb-2`}>КРАТКАЯ ИНФОРМАЦИЯ</div>
                    <div className={`text-[11px] break-words whitespace-pre-wrap ${textColor}`}>{selectedCharacter.shortInfo}</div>
                  </div>
                )}

                {/* Tasks */}
                {selectedCharacter.tasks.length > 0 && (
                  <div className={`p-3 ${isSecret ? 'bg-red-950/30 border-red-900/30' : 'bg-[#0a0a0a] border-[#2a2a2a]'} border rounded`}>
                    <button onClick={() => { playAllSound(); setTasksExpanded(!tasksExpanded); }} className={`w-full flex items-center justify-between ${textMuted} text-[10px] font-mono mb-2 hover:opacity-80 transition-colors`}>
                      <span>ЗАДАЧИ ({selectedCharacter.tasks.length})</span>
                      {tasksExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <div className="space-y-2 mt-2">
                      {activeTasks.map(task => (
                        <div key={task.id} className={`p-2 ${isSecret ? 'bg-red-950/50 border-red-900/30' : 'bg-[#050505] border-[#2a2a2a]'} border rounded relative`}>
                          <div className="absolute top-2 right-2">
                            <div className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${task.status === 'в работе' ? (isSecret ? 'border-yellow-600/50 text-yellow-500 bg-yellow-600/10' : 'border-yellow-500 text-yellow-400 bg-yellow-500/20') : task.status === 'провалено' ? (isSecret ? 'border-red-600/50 text-red-500 bg-red-600/10' : 'border-red-500 text-red-400 bg-red-500/20') : (isSecret ? 'border-gray-600/50 text-gray-400 bg-gray-600/10' : 'border-gray-500 text-gray-300 bg-gray-500/20')}`}>
                              {task.status}
                            </div>
                          </div>
                          <div className={`text-[11px] pr-20 break-words whitespace-pre-wrap ${textColor}`}>{task.description || 'Без описания'}</div>
                        </div>
                      ))}
                      {tasksExpanded && completedTasks.map(task => (
                        <div key={task.id} className={`p-2 ${isSecret ? 'bg-red-950/50 border-red-900/30' : 'bg-[#050505] border-[#2a2a2a]'} border rounded relative`}>
                          <div className="absolute top-2 right-2">
                            <div className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${task.status === 'провалено' ? (isSecret ? 'border-red-600/50 text-red-500 bg-red-600/10' : 'border-red-500 text-red-400 bg-red-500/20') : (isSecret ? 'border-gray-600/50 text-gray-400 bg-gray-600/10' : 'border-gray-500 text-gray-300 bg-gray-500/20')}`}>
                              {task.status}
                            </div>
                          </div>
                          <div className={`text-[11px] pr-20 break-words whitespace-pre-wrap ${textColor}`}>{task.description || 'Без описания'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Full Info */}
                {selectedCharacter.fullInfo && (
                  <div className={`p-3 ${isSecret ? 'bg-red-950/30 border-red-900/30' : 'bg-[#0a0a0a] border-[#2a2a2a]'} border rounded`}>
                    <div className={`${textMuted} text-[10px] font-mono mb-2`}>ПОЛНАЯ ИНФОРМАЦИЯ</div>
                    <div className={`text-[11px] break-words whitespace-pre-wrap ${textColor}`}>{selectedCharacter.fullInfo}</div>
                  </div>
                )}

                {/* Notes */}
                {selectedCharacter.notes && (
                  <div className={`p-3 ${isSecret ? 'bg-red-950/30 border-red-900/30' : 'bg-[#0a0a0a] border-[#2a2a2a]'} border rounded`}>
                    <div className={`${textMuted} text-[10px] font-mono mb-2`}>ЗАМЕТКИ</div>
                    <div className={`text-[11px] break-words whitespace-pre-wrap ${textColor}`}>{selectedCharacter.notes}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
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
        {/* АБД/БД toggle — только если есть доступ */}
        {canAccessAbd && (
          <button
            onClick={() => { playAllSound(); setActiveDatabase(activeDatabase === 'main' ? 'secret' : 'main'); setSearchQuery(''); setSelectedCharacter(null); }}
            className={`px-2 py-1 ${isSecret ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-[#2a2a2a] border-[#3a3a3a] text-gray-400'} border rounded font-mono text-xs hover:opacity-80`}
          >
            {isSecret ? 'АБД' : 'БД'}
          </button>
        )}
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
                    <div className={`${textMuted} font-mono text-xs mb-1 truncate`}>{char.birthDate}</div>
                  </div>
                </div>

                <div
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    playAllSound();
                    setExpandedShortInfo(expandedShortInfo === char.id ? null : char.id);
                  }}
                >
                  <div className={`${textMuted} font-mono text-xs break-words ${expandedShortInfo === char.id ? '' : 'line-clamp-2'}`}>
                    {char.shortInfo}
                  </div>
                  {char.shortInfo && char.shortInfo.length > 60 && (
                    <div className="text-gray-600 font-mono text-[8px] mt-1 text-right">
                      {expandedShortInfo === char.id ? '▲ Скрыть' : '▼ Показать'}
                    </div>
                  )}
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
