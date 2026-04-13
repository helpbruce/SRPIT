import { useState, useRef, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, ChevronLeft, ChevronDown, ChevronUp, List, Grid3X3, Calendar, Save, MessageSquare, Edit3, CheckSquare, FileText, X } from 'lucide-react';
import { supabase } from '../../shared/lib/supabaseClient';
import { CacheManager } from '../../shared/lib/cache';

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

interface Task {
  id: string;
  description: string;
  status: 'в работе' | 'провалено' | 'выполнено';
  reward?: string;
  timeLimit?: string;
}

interface CharacterEntry {
  id: string;
  character_id: string;
  author_login: string;
  content: string;
  entry_type: 'task' | 'short_info' | 'full_info' | 'notes' | 'edit';
  is_update: boolean;
  created_at: string;
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
  addTask?: () => void;
  updateTask?: (taskId: string, updates: Partial<Task>) => void;
  deleteTask?: (taskId: string) => void;
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

// Формат даты: [12.04.2009 | 15:30 (UTC+3:00) | user1]
const formatEntryDate = (isoDate: string | null) => {
  if (!isoDate) return '[— | — (UTC+3:00) | —]';
  const d = new Date(isoDate);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `[${day}.${month}.2009 | ${hours}:${minutes} (UTC+3:00) | `;
};

export function DatabaseView({
  activeDatabase, setActiveDatabase, viewMode, setViewMode,
  characters, setCharacters, searchQuery, setSearchQuery, filteredCharacters,
  selectedCharacter, setSelectedCharacter, isEditing, setIsEditing,
  isCreating, setIsCreating, editForm, setEditForm,
  tasksExpanded, setTasksExpanded, expandedShortInfo, setExpandedShortInfo,
  playAllSound, playSaveSound, currentLogin, supabase, isSecret, canAccessAbd,
  photo1InputRef, getTaskPlaceholder, addTask, updateTask, deleteTask,
}: DatabaseViewProps) {
  const [editTasksExpanded, setEditTasksExpanded] = useState(false);
  const [viewTasksExpanded, setViewTasksExpanded] = useState(false);
  const [viewFullInfoExpanded, setViewFullInfoExpanded] = useState(false);
  const [entries, setEntries] = useState<CharacterEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [fieldEditMode, setFieldEditMode] = useState({
    name: false,
    faction: false,
    rank: false,
    birthDate: false,
  });

  const isEditableField = (field: 'name' | 'faction' | 'rank' | 'birthDate') =>
    isCreating || fieldEditMode[field];
  const activateEditableField = (field: 'name' | 'faction' | 'rank' | 'birthDate') =>
    setFieldEditMode(prev => ({ ...prev, [field]: true }));
  const deactivateEditableField = (field: 'name' | 'faction' | 'rank' | 'birthDate') =>
    setFieldEditMode(prev => ({ ...prev, [field]: false }));

  const baseColor = isSecret ? 'red' : 'gray';
  const bgColor = isSecret ? 'bg-[#0a0505]' : 'bg-[#050505]';
  const borderColor = isSecret ? 'border-red-900/30' : 'border-[#2a2a2a]';
  const textColor = isSecret ? 'text-red-400' : 'text-gray-400';
  const textMuted = isSecret ? 'text-red-600' : 'text-gray-500';
  const textLight = isSecret ? 'text-red-300' : 'text-gray-300';
  const inputBg = isSecret ? 'bg-[#0f0a0a] border-red-900/30 placeholder:text-red-800' : 'bg-[#0a0a0a] border-[#2a2a2a] placeholder:text-gray-700';
  const cardBg = isSecret ? 'bg-red-950/20 border-red-900/30 hover:bg-red-900/30 hover:border-red-800/50' : 'bg-[#0a0a0a] border-[#2a2a2a] hover:bg-[#0f0f0f] hover:border-[#3a3a3a]';
  const cardWanted = isSecret ? 'bg-red-900/30 border-red-700 hover:bg-red-800/40' : 'bg-red-900/20 border-red-700 hover:bg-red-900/30';

  const entriesTableName = isSecret ? 'secret_character_entries' : 'pda_character_entries';

  // Загрузка записей для персонажа
  useEffect(() => {
    if (!selectedCharacter || !supabase) return;
    setLoadingEntries(true);
    supabase
      .from(entriesTableName)
      .select('*')
      .eq('character_id', selectedCharacter.id)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to load entries:', error);
          setEntries([]);
        } else {
          setEntries(data || []);
        }
        setLoadingEntries(false);
      });
  }, [selectedCharacter?.id, entriesTableName, supabase]);

  // Добавить новую запись
  const addEntry = async (content: string, type: CharacterEntry['entry_type'], isUpdate = false) => {
    if (!supabase || !selectedCharacter) return;
    const entry: CharacterEntry = {
      id: crypto.randomUUID(),
      character_id: selectedCharacter.id,
      author_login: currentLogin || 'Аноним',
      content,
      entry_type: type,
      is_update: isUpdate,
      created_at: new Date().toISOString(),
    };
    setEntries(prev => [...prev, entry]);
    await supabase.from(entriesTableName).insert(entry);
  };

  // Сохранение персонажа и запись в Supabase
  const saveCharacter = async () => {
    playSaveSound();
    if (!editForm) return;

    const updatedChars = isCreating
      ? [...characters, editForm]
      : characters.map(c => c.id === editForm.id ? editForm : c);
    setCharacters(updatedChars);
    const cacheKey = isSecret ? 'secret_characters' : 'pda_characters';
    CacheManager.set(cacheKey, updatedChars, 10 * 60 * 1000);

    const tableName = isSecret ? 'secret_characters' : 'pda_characters';
    const payload = {
      id: editForm.id,
      photo: editForm.photo || '',
      name: editForm.name || '',
      birthdate: editForm.birthDate || null,
      faction: editForm.faction || null,
      rank: editForm.rank || null,
      status: editForm.status || 'Неизвестен',
      shortinfo: editForm.shortInfo || null,
      fullinfo: editForm.fullInfo || null,
      notes: editForm.notes || null,
      casenumber: editForm.caseNumber || null,
      updated_at: new Date().toISOString(),
    };

    if (supabase) {
      const { error } = await supabase.from(tableName).upsert(payload, { onConflict: 'id' });
      if (error) {
        console.error(`Failed to upsert ${tableName} in Supabase:`, error);
        alert('Ошибка сохранения: ' + error.message);
        setCharacters(characters);
        CacheManager.set(cacheKey, characters, 10 * 60 * 1000);
        return;
      }
    }

    if (!isCreating && selectedCharacter) {
      if (editForm.shortInfo !== selectedCharacter.shortInfo) {
        addEntry(editForm.shortInfo || '—', 'short_info');
      }
      if (editForm.fullInfo !== selectedCharacter.fullInfo) {
        addEntry(editForm.fullInfo || '—', 'full_info');
      }
      if (editForm.notes !== selectedCharacter.notes) {
        addEntry(editForm.notes || '—', 'notes');
      }
      if (editForm.status !== selectedCharacter.status) {
        addEntry(`Статус изменён: ${editForm.status}`, 'edit');
      }
    }

    setSelectedCharacter(editForm);
    setIsCreating(false);
    setIsEditing(false);
    setEditForm(null);
    setFieldEditMode({ name: false, faction: false, rank: false, birthDate: false });
    setTasksExpanded(false);
    setEditTasksExpanded(false);
  };

  // ===== EDIT MODE =====
  if (isEditing && editForm) {
    return (
      <div className={`flex-1 flex flex-col overflow-hidden ${bgColor}`}>
        <div className={`p-3 border-b ${borderColor} flex items-center justify-between flex-shrink-0`}>
          <h2 className={`text-sm font-mono ${textMuted}`}>{isCreating ? 'НОВЫЙ ПЕРСОНАЖ' : 'РЕДАКТИРОВАНИЕ'}</h2>
          <div className="flex gap-2">
            {!isCreating && (
              <button onClick={() => {
                playAllSound();
                if (confirm('Удалить персонажа?')) {
                  const updated = characters.filter(c => c.id !== editForm.id);
                  setCharacters(updated);
                  const cacheKey = isSecret ? 'secret_characters' : 'pda_characters';
                  CacheManager.set(cacheKey, updated, 10 * 60 * 1000);

                  if (supabase) {
                    supabase
                      .from(isSecret ? 'secret_characters' : 'pda_characters')
                      .delete()
                      .eq('id', editForm.id)
                      .then(({ error }) => {
                        if (error) {
                          console.error('Failed to delete character from Supabase:', error);
                          setCharacters(characters);
                          CacheManager.set(cacheKey, characters, 10 * 60 * 1000);
                        }
                      });
                  }

                  setSelectedCharacter(null);
                  setIsEditing(false);
                  setEditForm(null);
                  setFieldEditMode({ name: false, faction: false, rank: false, birthDate: false });
                }
              }} className={`px-3 py-1.5 ${isSecret ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-red-900/30 border-red-800 text-red-400'} border rounded font-mono text-xs flex items-center gap-1 hover:opacity-80 transition-all`}>
                <Trash2 className="w-4 h-4" /> УДАЛИТЬ
              </button>
            )}
            <button onClick={() => { playAllSound(); setIsEditing(false); setIsCreating(false); setEditForm(null); setTasksExpanded(false); setEditTasksExpanded(false); setFieldEditMode({ name: false, faction: false, rank: false, birthDate: false }); }} className={`px-3 py-1.5 ${isSecret ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-[#2a2a2a] border-[#3a3a3a] text-gray-400'} border rounded font-mono text-xs hover:opacity-80 transition-all`}>ОТМЕНА</button>
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
                  {isEditableField('name') ? (
                    <input type="text" placeholder="Имя" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor} placeholder:opacity-30`} onBlur={() => !isCreating && deactivateEditableField('name')} />
                  ) : (
                    <div onDoubleClick={() => activateEditableField('name')} className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor} placeholder:opacity-30 cursor-pointer min-h-[38px]`}>{editForm.name || 'Дважды кликните для редактирования'}</div>
                  )}
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
                  {isEditableField('faction') ? (
                    <input type="text" placeholder="Фракция" value={editForm.faction} onChange={(e) => setEditForm({ ...editForm, faction: e.target.value })} className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor} placeholder:opacity-30`} onBlur={() => deactivateEditableField('faction')} />
                  ) : (
                    <div onDoubleClick={() => activateEditableField('faction')} className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor} placeholder:opacity-30 cursor-pointer min-h-[38px]`}>{editForm.faction || 'Дважды кликните для редактирования'}</div>
                  )}
                </div>
                <div>
                  <label className={`block ${textMuted} text-[10px] font-mono mb-1`}>РАНГ</label>
                  {isEditableField('rank') ? (
                    <input type="text" placeholder="Ранг" value={editForm.rank} onChange={(e) => setEditForm({ ...editForm, rank: e.target.value })} className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor} placeholder:opacity-30`} onBlur={() => deactivateEditableField('rank')} />
                  ) : (
                    <div onDoubleClick={() => activateEditableField('rank')} className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor} placeholder:opacity-30 cursor-pointer min-h-[38px]`}>{editForm.rank || 'Дважды кликните для редактирования'}</div>
                  )}
                </div>
                <div>
                  <label className={`block ${textMuted} text-[10px] font-mono mb-1`}>ДАТА РОЖДЕНИЯ</label>
                  {isEditableField('birthDate') ? (
                    <input type="text" placeholder="Дата рождения" value={editForm.birthDate} onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })} className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor} placeholder:opacity-30`} onBlur={() => deactivateEditableField('birthDate')} />
                  ) : (
                    <div onDoubleClick={() => activateEditableField('birthDate')} className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor} placeholder:opacity-30 cursor-pointer min-h-[38px]`}>{editForm.birthDate || 'Дважды кликните для редактирования'}</div>
                  )}
                </div>
              </div>

              {!isCreating && (
                <>
                  {/* Short Info - always editable */}
                  <div>
                    <label className={`block ${textMuted} text-[10px] font-mono mb-1`}>КРАТКАЯ ИНФО</label>
                    <textarea value={editForm.shortInfo} onChange={(e) => setEditForm({ ...editForm, shortInfo: e.target.value })} placeholder="Краткая информация о персонаже..." className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor} resize-none placeholder:opacity-30`} rows={3} />
                  </div>

                  {/* Full Info - always editable */}
                  <div>
                    <label className={`block ${textMuted} text-[10px] font-mono mb-1`}>ПОЛНАЯ ИНФО</label>
                    <textarea value={editForm.fullInfo} onChange={(e) => setEditForm({ ...editForm, fullInfo: e.target.value })} placeholder="Полная информация о персонаже..." className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor} resize-none placeholder:opacity-30`} rows={4} />
                  </div>

                  {/* Notes - always editable */}
                  <div>
                    <label className={`block ${textMuted} text-[10px] font-mono mb-1`}>ЗАМЕТКИ</label>
                    <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Заметки..." className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor} resize-none placeholder:opacity-30`} rows={2} />
                  </div>

                  {/* Tasks section */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={`block ${textMuted} text-[10px] font-mono`}>ЗАДАЧИ</label>
                      <button
                        onClick={() => setEditTasksExpanded(true)}
                        className={`px-2 py-0.5 ${isSecret ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-[#2a2a2a] border-[#3a3a3a] text-gray-400'} border rounded font-mono text-[10px] flex items-center gap-1`}
                      >
                        <Edit2 className="w-3 h-3" /> РЕДАКТИРОВАТЬ
                      </button>
                    </div>
                    <div className={`p-2 ${inputBg} border rounded font-mono text-xs ${textColor} min-h-[60px]`}>
                      {editForm.tasks && editForm.tasks.length > 0 ? (
                        <div className="space-y-1">
                          {editForm.tasks.slice(0, 3).map((task, index) => (
                            <div key={task.id} className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${task.status === 'в работе' ? 'bg-yellow-500' : task.status === 'провалено' ? 'bg-red-500' : 'bg-gray-500'}`}></div>
                              <span className="truncate">{task.description || 'Без описания'}</span>
                            </div>
                          ))}
                          {editForm.tasks.length > 3 && (
                            <div className={`${textMuted} text-[10px]`}>... и ещё {editForm.tasks.length - 3}</div>
                          )}
                        </div>
                      ) : (
                        <div className="opacity-30">Задач пока нет</div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== DETAIL VIEW (лента сообщений) =====
  if (selectedCharacter) {
    return (
      <div className={`flex-1 flex flex-col overflow-hidden ${bgColor}`}>
        <div className={`p-3 border-b ${borderColor} flex-shrink-0 flex items-center justify-between`}>
          <button onClick={() => { playAllSound(); setSelectedCharacter(null); setEntries([]); }} className={`px-3 py-1.5 ${isSecret ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-[#2a2a2a] border-[#3a3a3a] text-gray-400'} border rounded font-mono text-xs flex items-center gap-1 hover:opacity-80 transition-all`}>
            <ChevronLeft className="w-4 h-4" /> НАЗАД
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => { playAllSound(); setViewTasksExpanded(true); }}
              className={`px-3 py-1.5 ${isSecret ? 'bg-yellow-900/30 border-yellow-800 text-yellow-400' : 'bg-yellow-700/30 border-yellow-600 text-yellow-300'} border rounded font-mono text-xs flex items-center gap-1 hover:opacity-80 transition-all`}
            >
              <CheckSquare className="w-4 h-4" /> ЗАДАЧИ
            </button>
            <button
              onClick={() => { playAllSound(); setViewFullInfoExpanded(true); }}
              className={`px-3 py-1.5 ${isSecret ? 'bg-blue-900/30 border-blue-800 text-blue-400' : 'bg-blue-700/30 border-blue-600 text-blue-300'} border rounded font-mono text-xs flex items-center gap-1 hover:opacity-80 transition-all`}
            >
              <FileText className="w-4 h-4" /> ПОЛНАЯ ИНФО
            </button>
            <button onClick={() => {
              playAllSound();
              setIsCreating(false);
              setIsEditing(true);
              setEditForm(selectedCharacter);
              setFieldEditMode({ name: false, faction: false, rank: false, birthDate: false });
            }} className={`px-3 py-1.5 ${isSecret ? 'bg-green-900/30 border-green-800 text-green-400' : 'bg-gray-700/30 border-gray-600 text-gray-300'} border rounded font-mono text-xs flex items-center gap-1 hover:opacity-80 transition-all`}>
              <Edit2 className="w-4 h-4" /> РЕДАКТИРОВАТЬ
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pda-scrollbar">
          {/* Header */}
          <div className={`p-4 border-b ${borderColor}`}>
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <img src={selectedCharacter.photo} className="w-24 h-32 object-cover rounded border border-[#2a2a2a]" alt="" />
                <div className="mt-2 flex items-center justify-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${getStatusDotColor(selectedCharacter.status)} animate-pulse`}></div>
                  <span className={`${textMuted} font-mono text-[10px]`}>{selectedCharacter.status}</span>
                </div>
              </div>
              <div>
                <h2 className={`${textLight} font-mono text-lg font-bold`}>{selectedCharacter.name || 'Без имени'}</h2>
                <div className={`${textMuted} font-mono text-xs mt-1`}>{selectedCharacter.faction} • {selectedCharacter.rank}</div>
                {selectedCharacter.birthDate && <div className={`${textMuted} font-mono text-xs mt-1`}>
                  <Calendar className="w-3 h-3 inline mr-1" />{selectedCharacter.birthDate}
                </div>}
                {selectedCharacter.caseNumber && <div className={`${textMuted} font-mono text-xs mt-1`}>Дело: {selectedCharacter.caseNumber}</div>}
              </div>
            </div>
          </div>

          {/* Message feed */}
          <div className="p-4 space-y-3">
            <div className={`${textMuted} font-mono text-[10px] mb-2 flex items-center gap-2`}>
              <MessageSquare className="w-3 h-3" /> ЗАПИСИ
            </div>

            {loadingEntries ? (
              <div className={`${textMuted} font-mono text-xs`}>Загрузка записей...</div>
            ) : entries.length === 0 ? (
              <div className={`${textMuted} font-mono text-xs`}>Записей пока нет.</div>
            ) : (
              entries.map(entry => {
                return (
                  <div key={entry.id} className="group relative">
                    {/* Hover: full metadata */}
                    <div className="absolute -top-5 left-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      <span className={`${isSecret ? 'text-red-700' : 'text-gray-600'} font-mono text-[9px] bg-black/80 px-2 py-1 rounded`}>
                        {entry.author_login} • {formatEntryDate(entry.created_at).split(' | ')[1]}
                        {entry.is_update && <span className={`${isSecret ? 'text-yellow-600' : 'text-yellow-500'}`}> [UPD]</span>}
                      </span>
                    </div>
                    {/* Message bubble */}
                    <div className={`p-3 rounded-lg border ${
                      entry.entry_type === 'task'
                        ? isSecret ? 'bg-yellow-600/10 border-yellow-600/30' : 'bg-yellow-500/10 border-yellow-500/30'
                        : entry.entry_type === 'edit'
                        ? isSecret ? 'bg-blue-600/10 border-blue-600/30' : 'bg-blue-500/10 border-blue-500/30'
                        : isSecret ? 'bg-red-950/30 border-red-900/30' : 'bg-[#0a0a0a] border-[#2a2a2a]'
                    }`}>
                      <div className={`${textColor} font-mono text-xs whitespace-pre-wrap break-words`}>{entry.content}</div>
                    </div>
                  </div>
                );
              })
            )}
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
          onClick={() => {
            playAllSound();
            setIsCreating(true);
            setIsEditing(true);
            setEditForm({
              id: crypto.randomUUID(),
              photo: '/icons/nodata.png',
              name: '',
              birthDate: '',
              faction: '',
              rank: '',
              status: 'Неизвестен',
              shortInfo: '',
              fullInfo: '',
              notes: '',
              caseNumber: ''
            });
            setTasksExpanded(false);
            setFieldEditMode({ name: true, faction: true, rank: true, birthDate: true });
          }}
          className={`px-2 py-1 ${isSecret ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-[#2a2a2a] border-[#3a3a3a] text-gray-400'} border rounded font-mono text-xs flex items-center gap-1`}
        >
          <Plus className="w-3 h-3" /> СОЗДАТЬ
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pda-scrollbar p-3">
        {viewMode === 'cards' ? (
          <div className="grid grid-cols-2 gap-3">
            {filteredCharacters.map(char => (
              <div
                key={char.id}
                className={`p-3 border cursor-pointer transition-all rounded flex flex-col gap-2 relative ${char.status === 'В розыске' ? cardWanted : cardBg}`}
                onClick={() => { playAllSound(); setSelectedCharacter(char); }}
              >
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
          <div className="space-y-1">
            {filteredCharacters.map(char => (
              <div
                key={char.id}
                className={`p-2.5 border cursor-pointer transition-all rounded flex items-center gap-3 ${char.status === 'В розыске' ? cardWanted : cardBg}`}
                onClick={() => { playAllSound(); setSelectedCharacter(char); }}
              >
                <div className="flex-1 min-w-0">
                  <div className={`${textLight} font-mono text-sm font-bold truncate`}>
                    {char.name || 'Без имени'}
                    {char.status === 'В розыске' && <span className="text-red-500 ml-2 text-xs">[РОЗЫСК]</span>}
                  </div>
                  <div className={`${textMuted} font-mono text-[10px] truncate`}>
                    {char.faction}{char.rank ? ` • ${char.rank}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className={`text-[10px] font-mono flex items-center gap-1.5`}>
                    <div className={`w-2 h-2 rounded-full ${getStatusDotColor(char.status)}`}></div>
                    {char.status}
                  </div>
                  {char.caseNumber && <div className={`${textMuted} font-mono text-[10px]`}>{char.caseNumber}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredCharacters.length === 0 && (
          <div className={`${textMuted} font-mono text-xs text-center py-12`}>
            {searchQuery ? 'Ничего не найдено' : 'Записей пока нет. Создай первую!'}
          </div>
        )}
      </div>

      {/* Tasks Edit Modal */}
      {editTasksExpanded && editForm && (
        <div className="fixed inset-0 z-[100030] flex items-center justify-center pointer-events-auto">
          <div className="w-[min(90vw,500px)] bg-[#0a0a0a] border-2 border-[#2a2a2a] rounded p-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h3 className={`${textLight} font-mono text-sm font-bold`}>ЗАДАЧИ</h3>
              <button
                onClick={() => setEditTasksExpanded(false)}
                className="text-gray-500 hover:text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pda-scrollbar space-y-3">
              {editForm.tasks && editForm.tasks.length > 0 ? (
                editForm.tasks.map((task, index) => (
                  <div key={task.id} className={`p-3 border rounded ${isSecret ? 'bg-red-950/20 border-red-900/30' : 'bg-[#0f0f0f] border-[#2a2a2a]'}`}>
                    <div className="space-y-3">
                      <div>
                        <label className={`block ${textMuted} text-[10px] font-mono mb-1`}>ЗАДАНИЕ</label>
                        <textarea
                          value={task.description}
                          onChange={(e) => updateTask(task.id, { description: e.target.value })}
                          placeholder={getTaskPlaceholder(task.status)}
                          className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor} resize-none placeholder:opacity-30`}
                          rows={2}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={`block ${textMuted} text-[10px] font-mono mb-1`}>НАГРАДА</label>
                          <input
                            type="text"
                            value={task.reward || ''}
                            onChange={(e) => updateTask(task.id, { reward: e.target.value })}
                            placeholder="Награда за выполнение"
                            className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor} placeholder:opacity-30`}
                          />
                        </div>
                        <div>
                          <label className={`block ${textMuted} text-[10px] font-mono mb-1`}>ВРЕМЯ НА ВЫПОЛНЕНИЕ</label>
                          <input
                            type="text"
                            value={task.timeLimit || ''}
                            onChange={(e) => updateTask(task.id, { timeLimit: e.target.value })}
                            placeholder="Срок выполнения"
                            className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor} placeholder:opacity-30`}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div>
                          <label className={`block ${textMuted} text-[10px] font-mono mb-1`}>СТАТУС</label>
                          <select
                            value={task.status}
                            onChange={(e) => updateTask(task.id, { status: e.target.value as Task['status'] })}
                            className={`px-3 py-1 text-xs font-mono border rounded ${inputBg} ${textColor}`}
                          >
                            <option value="в работе">в работе</option>
                            <option value="провалено">провалено</option>
                            <option value="выполнено">выполнено</option>
                          </select>
                        </div>
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="text-red-500 hover:text-red-400 p-1 mt-4"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className={`${textMuted} font-mono text-xs text-center py-8`}>
                  Задач пока нет
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-4 flex-shrink-0">
              <button
                onClick={addTask}
                className={`px-3 py-1.5 ${isSecret ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-[#2a2a2a] border-[#3a3a3a] text-gray-400'} border rounded font-mono text-xs flex items-center gap-1 hover:opacity-80`}
              >
                <Plus className="w-4 h-4" /> ДОБАВИТЬ ЗАДАЧУ
              </button>
              <button
                onClick={() => setEditTasksExpanded(false)}
                className={`px-3 py-1.5 ${isSecret ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-[#2a2a2a] border-[#3a3a3a] text-gray-400'} border rounded font-mono text-xs hover:opacity-80`}
              >
                ЗАКРЫТЬ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Tasks Modal */}
      {viewTasksExpanded && selectedCharacter && (
        <div className="fixed inset-0 z-[100030] flex items-center justify-center pointer-events-auto">
          <div className="w-[min(90vw,600px)] bg-[#0a0a0a] border-2 border-[#2a2a2a] rounded p-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h3 className={`${textLight} font-mono text-sm font-bold`}>ЗАДАЧИ - {selectedCharacter.name}</h3>
              <button
                onClick={() => setViewTasksExpanded(false)}
                className="text-gray-500 hover:text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pda-scrollbar space-y-3">
              {selectedCharacter.tasks && selectedCharacter.tasks.length > 0 ? (
                selectedCharacter.tasks.map((task, index) => (
                  <div key={task.id} className={`p-4 border rounded ${isSecret ? 'bg-red-950/20 border-red-900/30' : 'bg-[#0f0f0f] border-[#2a2a2a]'}`}>
                    <div className="space-y-3">
                      <div>
                        <label className={`block ${textMuted} text-[10px] font-mono mb-1`}>ЗАДАНИЕ</label>
                        <div className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor} min-h-[60px]`}>
                          {task.description || 'Описание отсутствует'}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={`block ${textMuted} text-[10px] font-mono mb-1`}>НАГРАДА</label>
                          <div className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor}`}>
                            {task.reward || 'Не указана'}
                          </div>
                        </div>
                        <div>
                          <label className={`block ${textMuted} text-[10px] font-mono mb-1`}>ВРЕМЯ НА ВЫПОЛНЕНИЕ</label>
                          <div className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor}`}>
                            {task.timeLimit || 'Не указано'}
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className={`block ${textMuted} text-[10px] font-mono mb-1`}>СТАТУС</label>
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded border font-mono text-xs ${
                          task.status === 'в работе' ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400' :
                          task.status === 'провалено' ? 'bg-red-500/20 border-red-500 text-red-400' :
                          'bg-green-500/20 border-green-500 text-green-400'
                        }`}>
                          <div className={`w-2 h-2 rounded-full ${
                            task.status === 'в работе' ? 'bg-yellow-500' :
                            task.status === 'провалено' ? 'bg-red-500' : 'bg-green-500'
                          }`}></div>
                          {task.status}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className={`${textMuted} font-mono text-xs text-center py-8`}>
                  Задач нет
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-4 flex-shrink-0">
              <button
                onClick={() => setViewTasksExpanded(false)}
                className={`px-3 py-1.5 ${isSecret ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-[#2a2a2a] border-[#3a3a3a] text-gray-400'} border rounded font-mono text-xs hover:opacity-80`}
              >
                ЗАКРЫТЬ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Full Info Modal */}
      {viewFullInfoExpanded && selectedCharacter && (
        <div className="fixed inset-0 z-[100030] flex items-center justify-center pointer-events-auto">
          <div className="w-[min(90vw,600px)] bg-[#0a0a0a] border-2 border-[#2a2a2a] rounded p-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h3 className={`${textLight} font-mono text-sm font-bold`}>ПОЛНАЯ ИНФОРМАЦИЯ - {selectedCharacter.name}</h3>
              <button
                onClick={() => setViewFullInfoExpanded(false)}
                className="text-gray-500 hover:text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pda-scrollbar">
              <div className={`w-full p-4 ${inputBg} border rounded font-mono text-xs ${textColor} min-h-[300px] whitespace-pre-wrap`}>
                {selectedCharacter.fullInfo || 'Полная информация отсутствует'}
              </div>
            </div>

            <div className="flex gap-2 mt-4 flex-shrink-0">
              <button
                onClick={() => setViewFullInfoExpanded(false)}
                className={`px-3 py-1.5 ${isSecret ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-[#2a2a2a] border-[#3a3a3a] text-gray-400'} border rounded font-mono text-xs hover:opacity-80`}
              >
                ЗАКРЫТЬ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
