import { useState, useRef, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, ChevronLeft, ChevronDown, ChevronUp, List, Grid3X3, Calendar, Save, MessageSquare, Edit3, CheckSquare, FileText, X } from 'lucide-react';
import { supabase } from '../../shared/lib/supabaseClient';
import { CacheManager } from '../../shared/lib/cache';

// TTL для кэша: 24 часа
const CACHE_TTL = 24 * 60 * 60 * 1000;

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
  author_login?: string; // Кто создал задачу
  created_at?: string; // Когда создана
  updated_by?: string; // Кто последним редактировал
  updated_at?: string; // Когда редактировали
}

interface CharacterEntry {
  id: string;
  character_id: string;
  author_login: string;
  content: string;
  entry_type: 'task' | 'short_info' | 'full_info' | 'notes' | 'edit';
  is_update: boolean;
  created_at: string;
  target_section?: 'full_info' | 'tasks' | 'short_info' | 'notes';
  target_task_id?: string;
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
  getTaskPlaceholder: (status: Task['status']) => string;
  addTask?: () => void;
  updateTask?: (taskId: string, updates: Partial<Task>) => void;
  deleteTask?: (taskId: string) => void;
}

const getStatusDotColor = (status: string) => {
  switch (status) {
    case 'Активен': return 'bg-green-500';
    case 'Пропал': return 'bg-yellow-500';
    case 'Мертв': return 'bg-black-500 ring-1 ring-gray-600';
    case 'В розыске': return 'bg-red-500';
    default: return 'bg-gray-500';
  }
};

// Формат даты: [12.04.2009 | 15:30 (UTC+3:00) | user1]
const formatEntryDate = (isoDate: string | null) => {
  if (!isoDate) return '— | — (UTC+3:00)';
  const d = new Date(isoDate);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear());
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} | ${hours}:${minutes} (UTC+3:00)`;
};

export function DatabaseView({
  activeDatabase, setActiveDatabase, viewMode, setViewMode,
  characters, setCharacters, searchQuery, setSearchQuery, filteredCharacters,
  selectedCharacter, setSelectedCharacter, isEditing, setIsEditing,
  isCreating, setIsCreating, editForm, setEditForm,
  tasksExpanded, setTasksExpanded, expandedShortInfo, setExpandedShortInfo,
  playAllSound, playSaveSound, currentLogin, supabase, isSecret, canAccessAbd,
  getTaskPlaceholder, addTask, updateTask, deleteTask,
}: DatabaseViewProps) {
  const [editTasksExpanded, setEditTasksExpanded] = useState(false);
  const [detailSection, setDetailSection] = useState<'entries' | 'full_info' | 'tasks' | 'short_info' | 'notes'>('entries');
  const [taskInput, setTaskInput] = useState({ description: '', reward: '', timeLimit: '' });
  const [currentTimestamp, setCurrentTimestamp] = useState('');
  const [entries, setEntries] = useState<CharacterEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [fieldEditMode, setFieldEditMode] = useState({
    name: false,
    faction: false,
    rank: false,
    birthDate: false,
  });
  // Inline edit state for detail view
  const [detailEditMode, setDetailEditMode] = useState(false);
  const [detailForm, setDetailForm] = useState<Character | null>(null);
  // Task edit state
  const [editingTask, setEditingTask] = useState<{id: string; description: string; status: string; reward: string; timeLimit: string} | null>(null);
  // Highlighted task ID for navigation from log
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  // Full info edit state
  const [editingFullInfo, setEditingFullInfo] = useState(false);
  const [fullInfoText, setFullInfoText] = useState('');
  // Short info edit state
  const [editingShortInfo, setEditingShortInfo] = useState(false);
  const [shortInfoText, setShortInfoText] = useState('');
  // Notes edit state
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  // New task form state
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [newTaskForm, setNewTaskForm] = useState({ description: '', reward: '', timeLimit: '' });
  // Ref for character photo upload (separate from bestiary)
  const characterPhotoRef = useRef<HTMLInputElement>(null);

  const isEditableField = (field: 'name' | 'faction' | 'rank' | 'birthDate') =>
    isCreating || fieldEditMode[field];
  const activateEditableField = (field: 'name' | 'faction' | 'rank' | 'birthDate') =>
    setFieldEditMode(prev => ({ ...prev, [field]: true }));
  const deactivateEditableField = (field: 'name' | 'faction' | 'rank' | 'birthDate') =>
    setFieldEditMode(prev => ({ ...prev, [field]: false }));

  const baseColor = 'gray';
  const bgColor = 'bg-[#050505]';
  const borderColor = 'border-[#2a2a2a]';
  const textColor = 'text-gray-400';
  const textMuted = 'text-gray-500';
  const textLight = 'text-gray-300';
  const inputBg = 'bg-[#0a0a0a] border-[#2a2a2a] placeholder:text-gray-700';
  const cardBg = 'bg-[#0a0a0a] border-[#2a2a2a] hover:bg-[#0f0f0f] hover:border-[#3a3a3a]';
  const cardWanted = 'bg-red-900/20 border-red-700 hover:bg-red-900/30';

  const entriesTableName = isSecret ? 'secret_character_entries' : 'pda_character_entries';

  // Обработчик клика на запись — переход к разделу
  const handleEntryClick = (entry: CharacterEntry) => {
    playAllSound();
    if (entry.entry_type === 'task' || entry.entry_type === 'edit') {
      // Переход к задачам
      setDetailSection('tasks');
      // Подсветка нужной задачи
      if (entry.target_task_id) {
        setHighlightedTaskId(entry.target_task_id);
        // Убрать подсветку через 2 секунды
        setTimeout(() => setHighlightedTaskId(null), 2000);
      }
    } else if (entry.target_section) {
      setDetailSection(entry.target_section);
    }
  };

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

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setCurrentTimestamp(`${hours}:${minutes}`);
    };
    updateTime();
    const interval = window.setInterval(updateTime, 30000);
    return () => window.clearInterval(interval);
  }, []);

  // Добавить новую запись
  const addEntry = async (content: string, type: CharacterEntry['entry_type'], isUpdate = false, targetTaskId?: string) => {
    if (!supabase || !selectedCharacter) return;
    const entry: CharacterEntry = {
      id: crypto.randomUUID(),
      character_id: selectedCharacter.id,
      author_login: currentLogin || 'Аноним',
      content,
      entry_type: type,
      is_update: isUpdate,
      created_at: new Date().toISOString(),
      target_section: type === 'task' || type === 'edit' ? 'tasks' : type as CharacterEntry['target_section'],
      target_task_id: targetTaskId,
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
    CacheManager.set(cacheKey, updatedChars, CACHE_TTL);

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
      tasks: editForm.tasks || [],
      casenumber: editForm.caseNumber || null,
      updated_at: new Date().toISOString(),
    };

    if (supabase) {
      const { error } = await supabase.from(tableName).upsert(payload, { onConflict: 'id' });
      if (error) {
        console.error(`Failed to upsert ${tableName} in Supabase:`, error);
        alert('Ошибка сохранения: ' + error.message);
        setCharacters(characters);
        CacheManager.set(cacheKey, characters, CACHE_TTL);
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

  // ===== INLINE EDIT FUNCTIONS FOR DETAIL VIEW =====
  const startDetailEdit = () => {
    playAllSound();
    setDetailForm({ ...selectedCharacter! });
    setDetailEditMode(true);
  };

  const saveDetailEdit = async () => {
    playSaveSound();
    if (!detailForm) return;
    const updated = { ...selectedCharacter!, ...detailForm };
    setSelectedCharacter(updated);
    const updatedChars = characters.map(c => c.id === selectedCharacter!.id ? updated : c);
    setCharacters(updatedChars);
    const cacheKey = isSecret ? 'secret_characters' : 'pda_characters';
    CacheManager.set(cacheKey, updatedChars, CACHE_TTL);
    const tableName = isSecret ? 'secret_characters' : 'pda_characters';
    const payload = {
      id: detailForm.id,
      photo: detailForm.photo || '',
      name: detailForm.name || '',
      birthdate: detailForm.birthDate || null,
      faction: detailForm.faction || null,
      rank: detailForm.rank || null,
      status: detailForm.status || 'Неизвестен',
      shortinfo: detailForm.shortInfo || null,
      fullinfo: detailForm.fullInfo || null,
      notes: detailForm.notes || null,
      tasks: detailForm.tasks || [],
      casenumber: detailForm.caseNumber || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from(tableName).upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('Failed to save character:', error);
      alert('Ошибка сохранения: ' + error.message);
      setCharacters(characters);
      CacheManager.set(cacheKey, characters, CACHE_TTL);
    }
    setDetailEditMode(false);
    setDetailForm(null);
  };

  const cancelDetailEdit = () => {
    playAllSound();
    setDetailEditMode(false);
    setDetailForm(null);
  };

  const deleteSelectedCharacter = async () => {
    playAllSound();
    if (confirm('Удалить персонажа?')) {
      const updated = characters.filter(c => c.id !== selectedCharacter.id);
      setCharacters(updated);
      const cacheKey = isSecret ? 'secret_characters' : 'pda_characters';
      CacheManager.set(cacheKey, updated, CACHE_TTL);
      if (supabase) {
        await supabase.from(isSecret ? 'secret_characters' : 'pda_characters').delete().eq('id', selectedCharacter.id);
      }
      setSelectedCharacter(null);
      setEntries([]);
    }
  };

  const saveFullInfo = async () => {
    playSaveSound();
    const oldText = selectedCharacter!.fullInfo || '';
    const updated = { ...selectedCharacter!, fullInfo: fullInfoText };
    setSelectedCharacter(updated);
    const updatedChars = characters.map(c => c.id === selectedCharacter!.id ? updated : c);
    setCharacters(updatedChars);
    const cacheKey = isSecret ? 'secret_characters' : 'pda_characters';
    CacheManager.set(cacheKey, updatedChars, CACHE_TTL);
    const tableName = isSecret ? 'secret_characters' : 'pda_characters';
    await supabase.from(tableName).update({ fullinfo: fullInfoText, updated_at: new Date().toISOString() }).eq('id', selectedCharacter!.id);
    // Log the change with old and new text
    if (fullInfoText !== oldText && supabase) {
      const logEntry: CharacterEntry = {
        id: crypto.randomUUID(),
        character_id: selectedCharacter!.id,
        author_login: currentLogin || 'Аноним',
        content: `[ПОЛНАЯ ИНФО ИЗМЕНЕНА]\n\nБЫЛО:\n${oldText || '(пусто)'}\n\nСТАЛО:\n${fullInfoText || '(пусто)'}`,
        entry_type: 'full_info',
        is_update: true,
        created_at: new Date().toISOString(),
        target_section: 'full_info',
      };
      await supabase.from(entriesTableName).insert(logEntry);
    }
    setEditingFullInfo(false);
  };

  const saveShortInfo = async () => {
    playSaveSound();
    const oldText = selectedCharacter!.shortInfo || '';
    const updated = { ...selectedCharacter!, shortInfo: shortInfoText };
    setSelectedCharacter(updated);
    const updatedChars = characters.map(c => c.id === selectedCharacter!.id ? updated : c);
    setCharacters(updatedChars);
    const cacheKey = isSecret ? 'secret_characters' : 'pda_characters';
    CacheManager.set(cacheKey, updatedChars, CACHE_TTL);
    const tableName = isSecret ? 'secret_characters' : 'pda_characters';
    await supabase.from(tableName).update({ shortinfo: shortInfoText, updated_at: new Date().toISOString() }).eq('id', selectedCharacter!.id);
    // Log the change with old and new text
    if (shortInfoText !== oldText && supabase) {
      const logEntry: CharacterEntry = {
        id: crypto.randomUUID(),
        character_id: selectedCharacter!.id,
        author_login: currentLogin || 'Аноним',
        content: `[КРАТКАЯ ИНФО ИЗМЕНЕНА]\n\nБЫЛО:\n${oldText || '(пусто)'}\n\nСТАЛО:\n${shortInfoText || '(пусто)'}`,
        entry_type: 'short_info',
        is_update: true,
        created_at: new Date().toISOString(),
        target_section: 'short_info',
      };
      await supabase.from(entriesTableName).insert(logEntry);
    }
    setEditingShortInfo(false);
  };

  const saveNotesEdit = async () => {
    playSaveSound();
    const oldText = selectedCharacter!.notes || '';
    const updated = { ...selectedCharacter!, notes: notesText };
    setSelectedCharacter(updated);
    const updatedChars = characters.map(c => c.id === selectedCharacter!.id ? updated : c);
    setCharacters(updatedChars);
    const cacheKey = isSecret ? 'secret_characters' : 'pda_characters';
    CacheManager.set(cacheKey, updatedChars, CACHE_TTL);
    const tableName = isSecret ? 'secret_characters' : 'pda_characters';
    await supabase.from(tableName).update({ notes: notesText, updated_at: new Date().toISOString() }).eq('id', selectedCharacter!.id);
    // Log the change with old and new text
    if (notesText !== oldText && supabase) {
      const logEntry: CharacterEntry = {
        id: crypto.randomUUID(),
        character_id: selectedCharacter!.id,
        author_login: currentLogin || 'Аноним',
        content: `[ЗАМЕТКИ ИЗМЕНЕНЫ]\n\nБЫЛО:\n${oldText || '(пусто)'}\n\nСТАЛО:\n${notesText || '(пусто)'}`,
        entry_type: 'notes',
        is_update: true,
        created_at: new Date().toISOString(),
        target_section: 'notes',
      };
      await supabase.from(entriesTableName).insert(logEntry);
    }
    setEditingNotes(false);
  };

  const startTaskEdit = (task: Task) => {
    playAllSound();
    setEditingTask({
      id: task.id,
      description: task.description,
      status: task.status,
      reward: task.reward || '',
      timeLimit: task.timeLimit || '',
    });
  };

  const saveTaskEdit = async () => {
    playSaveSound();
    if (!editingTask || !selectedCharacter) return;
    const now = new Date().toISOString();
    const updatedTasks = selectedCharacter.tasks.map(t =>
      t.id === editingTask.id ? {
        ...t,
        description: editingTask.description,
        status: editingTask.status as Task['status'],
        reward: editingTask.reward,
        timeLimit: editingTask.timeLimit,
        updated_by: currentLogin || 'Аноним',
        updated_at: now,
      } : t
    );
    const updated = { ...selectedCharacter, tasks: updatedTasks };
    setSelectedCharacter(updated);
    const updatedChars = characters.map(c => c.id === selectedCharacter.id ? updated : c);
    setCharacters(updatedChars);
    const cacheKey = isSecret ? 'secret_characters' : 'pda_characters';
    CacheManager.set(cacheKey, updatedChars, CACHE_TTL);
    const tableName = isSecret ? 'secret_characters' : 'pda_characters';
    await supabase.from(tableName).update({ tasks: updatedTasks, updated_at: now }).eq('id', selectedCharacter.id);
    // Log the task edit
    const origTask = selectedCharacter.tasks.find(t => t.id === editingTask.id);
    if (origTask && supabase) {
      const changes: string[] = [];
      if (editingTask.description !== origTask.description) changes.push(`Текст: ${editingTask.description}`);
      if (editingTask.status !== origTask.status) changes.push(`Статус: ${editingTask.status}`);
      if (editingTask.timeLimit !== (origTask.timeLimit || '')) changes.push(`Время: ${editingTask.timeLimit}`);
      if (editingTask.reward !== (origTask.reward || '')) changes.push(`Награда: ${editingTask.reward}`);
      if (changes.length > 0) {
        // Формируем дату для записи
        const day = String(new Date(now).getDate()).padStart(2, '0');
        const month = String(new Date(now).getMonth() + 1).padStart(2, '0');
        const hours = String(new Date(now).getHours()).padStart(2, '0');
        const minutes = String(new Date(now).getMinutes()).padStart(2, '0');

        // Информация о создателе (если есть) и редакторе
        const creatorInfo = origTask.author_login ? `Созд: ${origTask.author_login}` : '';
        const editorInfo = `upd? ${currentLogin || 'Аноним'}`;
        const metaInfo = creatorInfo ? `${creatorInfo} | ${editorInfo}` : editorInfo;

        const logEntry: CharacterEntry = {
          id: crypto.randomUUID(),
          character_id: selectedCharacter.id,
          author_login: currentLogin || 'Аноним',
          content: `[ ${day}.${month}.2009 | ${hours}:${minutes} (UTC+3:00) | ${metaInfo} ]\n[ЗАДАЧА ИЗМЕНЕНА] ${changes.join(' | ')}`,
          entry_type: 'edit',
          is_update: true,
          created_at: now,
          target_section: 'tasks',
          target_task_id: editingTask.id,
        };
        await supabase.from(entriesTableName).insert(logEntry);
      }
    }
    setEditingTask(null);
  };

  // Создать новую задачу
  const createNewTask = async () => {
    playSaveSound();
    if (!newTaskForm.description.trim()) {
      alert('Опиши задачу перед сохранением');
      return;
    }
    if (!supabase || !selectedCharacter) return;
    const now = new Date().toISOString();
    const task: Task = {
      id: crypto.randomUUID(),
      description: newTaskForm.description.trim(),
      status: 'в работе',
      reward: newTaskForm.reward.trim(),
      timeLimit: newTaskForm.timeLimit.trim(),
      author_login: currentLogin || 'Аноним',
      created_at: now,
    };
    const updatedTasks = [...(selectedCharacter.tasks || []), task];
    const updated = { ...selectedCharacter, tasks: updatedTasks };
    setSelectedCharacter(updated);
    const updatedChars = characters.map(c => c.id === selectedCharacter.id ? updated : c);
    setCharacters(updatedChars);
    const cacheKey = isSecret ? 'secret_characters' : 'pda_characters';
    CacheManager.set(cacheKey, updatedChars, CACHE_TTL);
    const tableName = isSecret ? 'secret_characters' : 'pda_characters';
    await supabase.from(tableName).update({ tasks: updatedTasks, updated_at: now }).eq('id', selectedCharacter.id);
    // Log the new task
    const day = String(new Date(now).getDate()).padStart(2, '0');
    const month = String(new Date(now).getMonth() + 1).padStart(2, '0');
    const hours = String(new Date(now).getHours()).padStart(2, '0');
    const minutes = String(new Date(now).getMinutes()).padStart(2, '0');
    const taskInfo = `[ ${day}.${month}.2009 | ${hours}:${minutes} (UTC+3:00) | ${currentLogin || 'Аноним'} ]\nЗадача: ${task.description}${task.timeLimit ? ` | Время: ${task.timeLimit}` : ''}${task.reward ? ` | Награда: ${task.reward}` : ''}`;
    const logEntry: CharacterEntry = {
      id: crypto.randomUUID(),
      character_id: selectedCharacter.id,
      author_login: currentLogin || 'Аноним',
      content: taskInfo,
      entry_type: 'task',
      is_update: false,
      created_at: now,
      target_section: 'tasks',
      target_task_id: task.id,
    };
    await supabase.from(entriesTableName).insert(logEntry);
    setNewTaskForm({ description: '', reward: '', timeLimit: '' });
    setShowNewTaskForm(false);
    // Reload entries
    if (supabase) {
      const { data } = await supabase.from(entriesTableName).select('*').eq('character_id', selectedCharacter.id).order('created_at', { ascending: true });
      if (data) setEntries(data);
    }
  };

  // ===== DETAIL VIEW (лента сообщений) =====
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
                  CacheManager.set(cacheKey, updated, CACHE_TTL);

                  if (supabase) {
                    supabase
                      .from(isSecret ? 'secret_characters' : 'pda_characters')
                      .delete()
                      .eq('id', editForm.id)
                      .then(({ error }) => {
                        if (error) {
                          console.error('Failed to delete character from Supabase:', error);
                          setCharacters(characters);
                          CacheManager.set(cacheKey, characters, CACHE_TTL);
                        }
                      });
                  }

                  setSelectedCharacter(null);
                  setIsEditing(false);
                  setEditForm(null);
                  setFieldEditMode({ name: false, faction: false, rank: false, birthDate: false });
                }
              }} className={`px-3 py-1.5 bg-red-900/30 border-red-800 text-red-400 border rounded font-mono text-xs flex items-center gap-1 hover:opacity-80 transition-all`}>
                <Trash2 className="w-4 h-4" /> УДАЛИТЬ
              </button>
            )}
            <button onClick={() => { playAllSound(); setIsEditing(false); setIsCreating(false); setEditForm(null); setTasksExpanded(false); setEditTasksExpanded(false); setFieldEditMode({ name: false, faction: false, rank: false, birthDate: false }); }} className={`px-3 py-1.5 bg-[#2a2a2a] border-[#3a3a3a] text-gray-400 border rounded font-mono text-xs hover:opacity-80 transition-all`}>ОТМЕНА</button>
            <button onClick={saveCharacter} className={`px-3 py-1.5 bg-gray-700/30 border-gray-600 text-gray-300 border rounded font-mono text-xs flex items-center gap-1 hover:opacity-80 transition-all`}>
              <Save className="w-4 h-4" /> СОХРАНИТЬ
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pda-scrollbar p-4">
          <div className="mx-auto w-full max-w-[900px] flex gap-4">
            {/* Left - Photo */}
            <div className="flex-shrink-0">
              <div className="mb-3">
                <label className={`block ${textMuted} text-[10px] font-mono mb-1 text-center`}>НОМЕР ДЕЛА</label>
                <input type="text" value={editForm.caseNumber} onChange={(e) => setEditForm({ ...editForm, caseNumber: e.target.value })} placeholder="88005553535" className={`w-40 p-2 ${inputBg} border rounded font-mono text-xs ${textColor} focus:outline-none text-center placeholder:opacity-30`} />
              </div>
              <img src={editForm.photo} alt="Preview" className="w-40 h-56 object-cover rounded border border-[#2a2a2a] mb-3" />
              <div className="flex gap-2">
                <button onClick={() => { playAllSound(); characterPhotoRef.current?.click(); }} className={`flex-1 px-3 py-1.5 bg-[#2a2a2a] border-[#3a3a3a] text-gray-400 border rounded font-mono text-[10px] hover:opacity-80 transition-all`}>ФАЙЛ</button>
                <button onClick={() => { const url = prompt('Введите URL фотографии:'); if (url && editForm) setEditForm({ ...editForm, photo: url }); }} className={`flex-1 px-3 py-1.5 bg-[#2a2a2a] border-[#3a3a3a] text-gray-400 border rounded font-mono text-[10px] hover:opacity-80 transition-all`}>URL</button>
              </div>
              <input ref={characterPhotoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file && editForm) { const reader = new FileReader(); reader.onload = (ev) => { if (ev.target?.result) setEditForm({ ...editForm, photo: ev.target.result as string }); }; reader.readAsDataURL(file); } }} />
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
                        className={`px-2 py-0.5 bg-[#2a2a2a] border-[#3a3a3a] text-gray-400 border rounded font-mono text-[10px] flex items-center gap-1`}
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
    const cur = detailEditMode && detailForm ? detailForm : selectedCharacter;

    return (
      <div className={`flex-1 flex flex-col overflow-hidden ${bgColor}`}>
        {/* Header */}
        <div className={`p-3 border-b ${borderColor} flex-shrink-0 flex items-center justify-between`}>
          <button onClick={() => { playAllSound(); setSelectedCharacter(null); setEntries([]); setDetailSection('entries'); setTaskInput({ description: '', reward: '', timeLimit: '' }); setDetailEditMode(false); setDetailForm(null); }} className={`px-3 py-1.5 bg-[#2a2a2a] border-[#3a3a3a] text-gray-400 border rounded font-mono text-xs flex items-center gap-1 hover:opacity-80 transition-all`}>
            <ChevronLeft className="w-4 h-4" /> НАЗАД
          </button>
          <div className="flex gap-2">
            <button
              onClick={deleteSelectedCharacter}
              className={`px-3 py-1.5 bg-red-900/30 border-red-800 text-red-400 border rounded font-mono text-xs flex items-center gap-1 hover:opacity-80 transition-all`}
            >
              <Trash2 className="w-4 h-4" /> УДАЛИТЬ
            </button>
            {detailEditMode ? (
              <>
                <button onClick={cancelDetailEdit} className={`px-3 py-1.5 bg-[#2a2a2a] border-[#3a3a3a] text-gray-400 border rounded font-mono text-xs hover:opacity-80 transition-all`}>ОТМЕНА</button>
                <button onClick={saveDetailEdit} className={`px-3 py-1.5 bg-green-900/30 border-green-800 text-green-400 border rounded font-mono text-xs flex items-center gap-1 hover:opacity-80 transition-all`}><Save className="w-4 h-4" /> СОХРАНИТЬ</button>
              </>
            ) : (
              <button onClick={startDetailEdit} className={`px-3 py-1.5 bg-gray-700/30 border-gray-600 text-gray-300 border rounded font-mono text-xs flex items-center gap-1 hover:opacity-80 transition-all`}><Edit2 className="w-4 h-4" /> ИЗМЕНИТЬ</button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pda-scrollbar">
          {/* Character Header */}
          <div className={`p-4 border-b ${borderColor}`}>
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <img src={cur.photo} className="w-24 h-32 object-cover rounded border border-[#2a2a2a]" alt="" />
                <div className="mt-2 flex items-center justify-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${getStatusDotColor(cur.status)} animate-pulse`}></div>
                  <span className={`${textMuted} font-mono text-[10px]`}>{cur.status}</span>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <label className={`block ${textMuted} text-[9px] font-mono mb-0.5`}>ИМЯ</label>
                  {detailEditMode ? (
                    <input type="text" value={cur.name} onChange={(e) => setDetailForm({...cur, name: e.target.value})} className={`w-full p-1.5 ${inputBg} border rounded font-mono text-xs ${textColor} focus:outline-none`} />
                  ) : (
                    <h2 className={`${textLight} font-mono text-lg font-bold`}>{cur.name || 'Без имени'}</h2>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`block ${textMuted} text-[9px] font-mono mb-0.5`}>ФРАКЦИЯ</label>
                    {detailEditMode ? (
                      <input type="text" value={cur.faction} onChange={(e) => setDetailForm({...cur, faction: e.target.value})} className={`w-full p-1.5 ${inputBg} border rounded font-mono text-xs ${textColor} focus:outline-none`} />
                    ) : (
                      <div className={`${textMuted} font-mono text-xs`}>{cur.faction || '—'}</div>
                    )}
                  </div>
                  <div>
                    <label className={`block ${textMuted} text-[9px] font-mono mb-0.5`}>РАНГ</label>
                    {detailEditMode ? (
                      <input type="text" value={cur.rank} onChange={(e) => setDetailForm({...cur, rank: e.target.value})} className={`w-full p-1.5 ${inputBg} border rounded font-mono text-xs ${textColor} focus:outline-none`} />
                    ) : (
                      <div className={`${textMuted} font-mono text-xs`}>{cur.rank || '—'}</div>
                    )}
                  </div>
                  <div>
                    <label className={`block ${textMuted} text-[9px] font-mono mb-0.5`}>ДАТА РОЖДЕНИЯ</label>
                    {detailEditMode ? (
                      <input type="text" value={cur.birthDate} onChange={(e) => setDetailForm({...cur, birthDate: e.target.value})} className={`w-full p-1.5 ${inputBg} border rounded font-mono text-xs ${textColor} focus:outline-none`} />
                    ) : (
                      <div className={`${textMuted} font-mono text-xs`}>{cur.birthDate ? `${cur.birthDate}` : '—'}</div>
                    )}
                  </div>
                  <div>
                    <label className={`block ${textMuted} text-[9px] font-mono mb-0.5`}>ДЕЛО</label>
                    {detailEditMode ? (
                      <input type="text" value={cur.caseNumber} onChange={(e) => setDetailForm({...cur, caseNumber: e.target.value})} className={`w-full p-1.5 ${inputBg} border rounded font-mono text-xs ${textColor} focus:outline-none`} />
                    ) : (
                      <div className={`${textMuted} font-mono text-xs`}>{cur.caseNumber || '—'}</div>
                    )}
                  </div>
                </div>
                <div>
                  <label className={`block ${textMuted} text-[9px] font-mono mb-0.5`}>СТАТУС</label>
                  {detailEditMode ? (
                    <select value={cur.status} onChange={(e) => setDetailForm({...cur, status: e.target.value})} className={`w-full p-1.5 ${inputBg} border rounded font-mono text-xs ${textColor} focus:outline-none`}>
                      <option value="Активен">Активен</option><option value="Пропал">Пропал</option><option value="Мертв">Мертв</option><option value="В розыске">В розыске</option><option value="Неизвестен">Неизвестен</option>
                    </select>
                  ) : (
                    <div className={`${textMuted} font-mono text-xs`}>{cur.status}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className={`p-4 border-b ${borderColor}`}>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'entries' as const, label: 'Записи', icon: <MessageSquare className="w-3 h-3" /> },
                { key: 'full_info' as const, label: 'Полная информация', icon: <FileText className="w-3 h-3" /> },
                { key: 'tasks' as const, label: 'Задачи', icon: <CheckSquare className="w-3 h-3" /> },
                { key: 'short_info' as const, label: 'Краткая информация', icon: <List className="w-3 h-3" /> },
                { key: 'notes' as const, label: 'Заметки', icon: <Edit3 className="w-3 h-3" /> },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { playAllSound(); setDetailSection(tab.key); }}
                  className={`px-3 py-1.5 border rounded font-mono text-[10px] flex items-center gap-2 ${detailSection === tab.key ? 'bg-[#2a2a2a] border-[#5c5c5c] text-gray-100' : 'bg-[#0a0a0a] border-[#2a2a2a] text-gray-400 hover:bg-[#111111]'}`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Записи */}
            {detailSection === 'entries' && (
              <div className="space-y-3">
                <div className={`${textMuted} font-mono text-[10px] mb-2 flex items-center gap-2`}>
                  <MessageSquare className="w-3 h-3" /> ЗАПИСИ
                </div>
                {loadingEntries ? (
                  <div className={`${textMuted} font-mono text-xs`}>Загрузка записей...</div>
                ) : entries.length === 0 ? (
                  <div className={`${textMuted} font-mono text-xs`}>Записей пока нет.</div>
                ) : (
                  entries.map(entry => (
                    <div
                      key={entry.id}
                      className={`group relative ${entry.target_section ? 'cursor-pointer' : ''}`}
                      onClick={() => handleEntryClick(entry)}
                    >
                      <div className="absolute -top-5 left-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        <span className={`text-gray-600 font-mono text-[9px] bg-black/80 px-2 py-1 rounded`}>
                          [{formatEntryDate(entry.created_at)} | {entry.author_login}]
                        </span>
                      </div>
                      <div className={`p-3 rounded-lg border transition-all ${
                        entry.entry_type === 'task'
                          ? 'bg-yellow-500/10 border-yellow-500/30 hover:border-yellow-400/50'
                          : entry.entry_type === 'edit'
                          ? 'bg-blue-500/10 border-blue-500/30 hover:border-blue-400/50'
                          : 'bg-[#0a0a0a] border-[#2a2a2a] hover:border-[#4a4a4a]'
                      } ${entry.target_section ? 'hover:shadow-md' : ''}`}>
                        <div className={`${textColor} font-mono text-xs whitespace-pre-wrap break-words`}>{entry.content}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Полная информация — редактируемая */}
            {detailSection === 'full_info' && (
              <div className="space-y-3">
                <div className={`${textMuted} font-mono text-[10px] mb-2 flex items-center justify-between`}>
                  <div className="flex items-center gap-2"><FileText className="w-3 h-3" /> ПОЛНАЯ ИНФО</div>
                  {editingFullInfo ? (
                    <button onClick={saveFullInfo} className={`px-2 py-0.5 bg-green-900/30 border-green-800 text-green-400 border rounded font-mono text-[10px] flex items-center gap-1`}><Save className="w-3 h-3" /> СОХРАНИТЬ</button>
                  ) : (
                    <button onClick={() => { playAllSound(); setFullInfoText(selectedCharacter.fullInfo || ''); setEditingFullInfo(true); }} className={`px-2 py-0.5 bg-gray-700/30 border-gray-600 text-gray-300 border rounded font-mono text-[10px] flex items-center gap-1`}><Edit2 className="w-3 h-3" /> ИЗМЕНИТЬ</button>
                  )}
                </div>
                {editingFullInfo ? (
                  <textarea
                    value={fullInfoText}
                    onChange={(e) => setFullInfoText(e.target.value)}
                    className={`w-full p-3 ${inputBg} border rounded font-mono text-xs ${textColor} resize-none focus:outline-none`}
                    rows={12}
                    autoFocus
                  />
                ) : (
                  <div className={`w-full p-4 ${inputBg} border rounded font-mono text-xs ${textColor} min-h-[300px] whitespace-pre-wrap`}>
                    {selectedCharacter.fullInfo || 'Полная информация отсутствует'}
                  </div>
                )}
              </div>
            )}

            {/* Задачи — список с кнопкой добавить */}
            {detailSection === 'tasks' && (
              <div className="space-y-3">
                <div className={`${textMuted} font-mono text-[10px] mb-2 flex items-center justify-between`}>
                  <div className="flex items-center gap-2"><CheckSquare className="w-3 h-3" /> ВЫДАННЫЕ ЗАДАЧИ</div>
                  <button
                    onClick={() => { playAllSound(); setShowNewTaskForm(!showNewTaskForm); }}
                    className={`px-2 py-0.5 bg-gray-700/30 border-gray-600 text-gray-300 border rounded font-mono text-[10px] flex items-center gap-1`}
                  >
                    <Plus className="w-3 h-3" /> ДОБАВИТЬ
                  </button>
                </div>

                {/* Форма новой задачи */}
                {showNewTaskForm && (
                  <div className={`space-y-3 p-4 border rounded ${inputBg}`}>
                    <div>
                      <label className={`block ${textMuted} text-[10px] font-mono mb-1`}>ЗАДАЧА</label>
                      <textarea
                        value={newTaskForm.description}
                        onChange={(e) => setNewTaskForm({ ...newTaskForm, description: e.target.value })}
                        placeholder="Описание задачи..."
                        className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor} resize-none placeholder:opacity-30`}
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={`block ${textMuted} text-[10px] font-mono mb-1`}>ВРЕМЯ НА ВЫПОЛНЕНИЕ</label>
                        <input
                          type="text"
                          value={newTaskForm.timeLimit}
                          onChange={(e) => setNewTaskForm({ ...newTaskForm, timeLimit: e.target.value })}
                          placeholder="Срок выполнения"
                          className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor} placeholder:opacity-30`}
                        />
                      </div>
                      <div>
                        <label className={`block ${textMuted} text-[10px] font-mono mb-1`}>НАГРАДА</label>
                        <input
                          type="text"
                          value={newTaskForm.reward}
                          onChange={(e) => setNewTaskForm({ ...newTaskForm, reward: e.target.value })}
                          placeholder="Награда"
                          className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor} placeholder:opacity-30`}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={createNewTask} className={`px-4 py-2 bg-green-700/30 border-green-600 text-green-200 border rounded font-mono text-xs flex items-center gap-1`}><Save className="w-3 h-3" /> СОХРАНИТЬ</button>
                      <button onClick={() => { playAllSound(); setShowNewTaskForm(false); }} className={`px-4 py-2 bg-[#2a2a2a] border-[#3a3a3a] text-gray-400 border rounded font-mono text-xs`}>ОТМЕНА</button>
                    </div>
                  </div>
                )}

                {/* Список задач */}
                {selectedCharacter.tasks && selectedCharacter.tasks.length > 0 ? (
                  selectedCharacter.tasks.map(task => {
                    // Форматируем дату создания
                    const createdDate = task.created_at ? new Date(task.created_at) : null;
                    const createdDateStr = createdDate ? (() => {
                      const day = String(createdDate.getDate()).padStart(2, '0');
                      const month = String(createdDate.getMonth() + 1).padStart(2, '0');
                      const hours = String(createdDate.getHours()).padStart(2, '0');
                      const minutes = String(createdDate.getMinutes()).padStart(2, '0');
                      return `${day}.${month}.2009 | ${hours}:${minutes}`;
                    })() : null;

                    // Форматируем дату обновления
                    const updatedDate = task.updated_at ? new Date(task.updated_at) : null;
                    const updatedDateStr = updatedDate ? (() => {
                      const day = String(updatedDate.getDate()).padStart(2, '0');
                      const month = String(updatedDate.getMonth() + 1).padStart(2, '0');
                      const hours = String(updatedDate.getHours()).padStart(2, '0');
                      const minutes = String(updatedDate.getMinutes()).padStart(2, '0');
                      return `${day}.${month}.2009 | ${hours}:${minutes}`;
                    })() : null;

                    return (
                      <div
                        key={task.id}
                        onDoubleClick={() => startTaskEdit(task)}
                        className={`group relative p-3 rounded-lg border cursor-pointer transition-all ${
                          task.id === highlightedTaskId
                            ? 'bg-green-900/30 border-green-500/60 ring-2 ring-green-500/30'
                            : 'bg-[#0f0f0f] border-[#2a2a2a] hover:bg-[#1a1a1a]'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-2 h-2 rounded-full ${task.status === 'в работе' ? 'bg-yellow-500' : task.status === 'провалено' ? 'bg-red-500' : 'bg-green-500'}`}></div>
                          <span className={`font-mono text-[10px] ${task.status === 'в работе' ? 'text-yellow-400' : task.status === 'провалено' ? 'text-red-400' : 'text-green-400'}`}>{task.status.toUpperCase()}</span>
                        </div>
                        <div className="font-mono text-xs text-gray-200 whitespace-pre-wrap">{task.description}</div>
                        <div className="mt-1 text-[10px] font-mono text-gray-500">
                          {task.timeLimit ? `Срок: ${task.timeLimit}` : 'Срок не указан'}
                          {task.reward ? ` • Награда: ${task.reward}` : ''}
                        </div>

                        {/* Информация о создателе и редакторе (при наведении) */}
                        {(task.author_login || task.updated_by) && (
                          <div className="mt-2 pt-2 border-t border-[#2a2a2a] opacity-0 group-hover:opacity-100 transition-opacity">
                            {task.author_login && createdDateStr && (
                              <div className="text-[9px] font-mono text-gray-400">
                                <span className="text-gray-500">Созд:</span> [ {createdDateStr} (UTC+3:00) | {task.author_login} ]
                              </div>
                            )}
                            {task.updated_by && updatedDateStr && (
                              <div className="text-[9px] font-mono text-yellow-400/70">
                                <span className="text-yellow-500/70">upd?:</span> [ {updatedDateStr} (UTC+3:00) | {task.updated_by} ]
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className={`${textMuted} font-mono text-xs`}>Задач нет.</div>
                )}
              </div>
            )}

            {/* Краткая информация — редактируемая */}
            {detailSection === 'short_info' && (
              <div className="space-y-3">
                <div className={`${textMuted} font-mono text-[10px] mb-2 flex items-center justify-between`}>
                  <div className="flex items-center gap-2"><List className="w-3 h-3" /> КРАТКАЯ ИНФО</div>
                  {editingShortInfo ? (
                    <button onClick={saveShortInfo} className={`px-2 py-0.5 bg-green-900/30 border-green-800 text-green-400 border rounded font-mono text-[10px] flex items-center gap-1`}><Save className="w-3 h-3" /> СОХРАНИТЬ</button>
                  ) : (
                    <button onClick={() => { playAllSound(); setShortInfoText(selectedCharacter.shortInfo || ''); setEditingShortInfo(true); }} className={`px-2 py-0.5 bg-gray-700/30 border-gray-600 text-gray-300 border rounded font-mono text-[10px] flex items-center gap-1`}><Edit2 className="w-3 h-3" /> ИЗМЕНИТЬ</button>
                  )}
                </div>
                {editingShortInfo ? (
                  <textarea
                    value={shortInfoText}
                    onChange={(e) => setShortInfoText(e.target.value)}
                    className={`w-full p-3 ${inputBg} border rounded font-mono text-xs ${textColor} resize-none focus:outline-none`}
                    rows={6}
                    autoFocus
                  />
                ) : (
                  <div className={`w-full p-4 ${inputBg} border rounded font-mono text-xs ${textColor} min-h-[180px] whitespace-pre-wrap`}>
                    {selectedCharacter.shortInfo || 'Краткая информация отсутствует'}
                  </div>
                )}
              </div>
            )}

            {/* Заметки — редактируемые */}
            {detailSection === 'notes' && (
              <div className="space-y-3">
                <div className={`${textMuted} font-mono text-[10px] mb-2 flex items-center justify-between`}>
                  <div className="flex items-center gap-2"><Edit3 className="w-3 h-3" /> ЗАМЕТКИ</div>
                  {editingNotes ? (
                    <button onClick={saveNotesEdit} className={`px-2 py-0.5 bg-green-900/30 border-green-800 text-green-400 border rounded font-mono text-[10px] flex items-center gap-1`}><Save className="w-3 h-3" /> СОХРАНИТЬ</button>
                  ) : (
                    <button onClick={() => { playAllSound(); setNotesText(selectedCharacter.notes || ''); setEditingNotes(true); }} className={`px-2 py-0.5 bg-gray-700/30 border-gray-600 text-gray-300 border rounded font-mono text-[10px] flex items-center gap-1`}><Edit2 className="w-3 h-3" /> ИЗМЕНИТЬ</button>
                  )}
                </div>
                {editingNotes ? (
                  <textarea
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    className={`w-full p-3 ${inputBg} border rounded font-mono text-xs ${textColor} resize-none focus:outline-none`}
                    rows={6}
                    autoFocus
                  />
                ) : (
                  <div className={`w-full p-4 ${inputBg} border rounded font-mono text-xs ${textColor} min-h-[180px] whitespace-pre-wrap`}>
                    {selectedCharacter.notes || 'Заметки отсутствуют'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Task Edit Modal */}
        {editingTask && (
          <div className="fixed inset-0 z-[100050] flex items-center justify-center pointer-events-auto">
            <div className="w-[min(90vw,500px)] bg-[#0a0a0a] border-2 border-[#2a2a2a] rounded p-5 max-h-[80vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h3 className={`${textLight} font-mono text-sm font-bold`}>РЕДАКТИРОВАНИЕ ЗАДАЧИ</h3>
                <button onClick={() => { playAllSound(); setEditingTask(null); }} className="text-gray-500 hover:text-gray-400"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto pda-scrollbar space-y-3">
                <div>
                  <label className={`block ${textMuted} text-[10px] font-mono mb-1`}>ЗАДАЧА</label>
                  <textarea value={editingTask.description} onChange={(e) => setEditingTask({...editingTask, description: e.target.value})} className={`w-full p-2.5 ${inputBg} border rounded font-mono text-xs ${textColor} resize-none focus:outline-none`} rows={3} autoFocus />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block ${textMuted} text-[10px] font-mono mb-1`}>ВРЕМЯ НА ВЫПОЛНЕНИЕ</label>
                    <input type="text" value={editingTask.timeLimit} onChange={(e) => setEditingTask({...editingTask, timeLimit: e.target.value})} className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor} focus:outline-none`} />
                  </div>
                  <div>
                    <label className={`block ${textMuted} text-[10px] font-mono mb-1`}>НАГРАДА</label>
                    <input type="text" value={editingTask.reward} onChange={(e) => setEditingTask({...editingTask, reward: e.target.value})} className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor} focus:outline-none`} />
                  </div>
                </div>
                <div>
                  <label className={`block ${textMuted} text-[10px] font-mono mb-1`}>СТАТУС</label>
                  <select value={editingTask.status} onChange={(e) => setEditingTask({...editingTask, status: e.target.value})} className={`w-full p-2 ${inputBg} border rounded font-mono text-xs ${textColor} focus:outline-none`}>
                    <option value="в работе">В работе</option>
                    <option value="выполнено">Выполнено</option>
                    <option value="провалено">Провалено</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-4 flex-shrink-0">
                <button onClick={saveTaskEdit} className={`flex-1 px-4 py-2.5 bg-green-900/30 border-green-800 text-green-300 border rounded font-mono text-xs flex items-center justify-center gap-2`}><Save className="w-4 h-4" /> СОХРАНИТЬ</button>
                <button onClick={() => { playAllSound(); setEditingTask(null); }} className={`px-4 py-2.5 bg-red-900/30 border-red-800 text-red-400 border rounded font-mono text-xs`}>ОТМЕНА</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===== LIST VIEW (cards or compact) =====
  return (
    <div className={`flex-1 flex flex-col overflow-hidden ${bgColor}`}>
      {/* Toolbar */}
      <div className={`p-3 border-b ${borderColor} flex items-center gap-2 flex-shrink-0`}>
        <Search className={`w-4 h-4 text-gray-600`} />
        <input
          type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск... (введи 'задача' для поиска)"
          className={`flex-1 bg-transparent border-none font-mono text-xs ${textColor} placeholder:opacity-40 focus:outline-none`}
        />
        {/* АБД/БД toggle — только если есть доступ */}
        {canAccessAbd && (
          <button
            onClick={() => { playAllSound(); setActiveDatabase(activeDatabase === 'main' ? 'secret' : 'main'); setSearchQuery(''); setSelectedCharacter(null); setDetailSection('entries'); setTaskInput({ description: '', reward: '', timeLimit: '' }); }}
            className={`px-2 py-1 bg-[#2a2a2a] border-[#3a3a3a] text-gray-400 border rounded font-mono text-xs hover:opacity-80`}
          >
            {isSecret ? 'АБД' : 'БД'}
          </button>
        )}
        {/* View mode toggle */}
        <button
          onClick={() => setViewMode(viewMode === 'cards' ? 'list' : 'cards')}
          className={`p-1.5 bg-[#2a2a2a] border-[#3a3a3a] text-gray-400 border rounded hover:opacity-80`}
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
          className={`px-2 py-1 bg-[#2a2a2a] border-[#3a3a3a] text-gray-400 border rounded font-mono text-xs flex items-center gap-1`}
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
                onClick={() => { playAllSound(); setSelectedCharacter(char); setDetailSection('entries'); setTaskInput({ description: '', reward: '', timeLimit: '' }); }}
              >
                <div className="flex gap-3">
                  <div className="flex-shrink-0 relative">
                    <img src={char.photo} alt={char.name} className="w-20 h-28 object-cover rounded border border-[#2a2a2a]" />
                    <div className="absolute top-1 left-0 right-0 flex justify-center">
                      <div className="flex items-center gap-1 px-2 py-1 rounded bg-black/70">
                        <div className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(char.status)}`}></div>
                        <span className="text-white font-mono text-[9px]">{char.status}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex items-center gap-2">
                      <div className={`${textLight} font-mono text-lg truncate`}>{char.name}</div>
                      {char.tasks && char.tasks.some(t => t.status === 'в работе') && (
                        <span className="flex-shrink-0 px-1.5 py-0.5 bg-yellow-600/30 border border-yellow-600/50 rounded text-yellow-400 font-mono text-[9px]">
                          ЗАДАЧА
                        </span>
                      )}
                    </div>
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
                onClick={() => { playAllSound(); setSelectedCharacter(char); setDetailSection('entries'); setTaskInput({ description: '', reward: '', timeLimit: '' }); }}
              >
                <div className="flex-1 min-w-0">
                  <div className={`${textLight} font-mono text-sm font-bold truncate`}>
                    {char.name || 'Без имени'}
                    {char.status === 'В розыске' && <span className="text-red-500 ml-2 text-xs">[РОЗЫСК]</span>}
                    {char.tasks && char.tasks.some(t => t.status === 'в работе') && <span className="ml-2 text-xs text-yellow-400">⚡</span>}
                  </div>
                  <div className={`${textMuted} font-mono text-[10px] truncate`}>
                    {char.faction}{char.rank ? ` • ${char.rank}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className={`text-[10px] font-mono flex items-center gap-1.5`}>
                    <div className={`w-2 h-2 rounded-full ${getStatusDotColor(char.status)}`}></div>
                    <span className="text-white">{char.status}</span>
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
                  <div key={task.id} className={`p-3 border rounded bg-[#0f0f0f] border-[#2a2a2a]`}>
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
                className={`px-3 py-1.5 bg-[#2a2a2a] border-[#3a3a3a] text-gray-400 border rounded font-mono text-xs flex items-center gap-1 hover:opacity-80`}
              >
                <Plus className="w-4 h-4" /> ДОБАВИТЬ ЗАДАЧУ
              </button>
              <button
                onClick={() => setEditTasksExpanded(false)}
                className={`px-3 py-1.5 bg-[#2a2a2a] border-[#3a3a3a] text-gray-400 border rounded font-mono text-xs hover:opacity-80`}
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
