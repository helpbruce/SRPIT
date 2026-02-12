import { useState, useEffect, useRef } from 'react';
import { X, Plus, Edit2, Save, Calendar, ChevronLeft, Search, ChevronDown, ChevronUp, Trash2, Database, BookOpen } from 'lucide-react';
import { supabase } from '../../shared/lib/supabaseClient';

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

interface BestiaryEntry {
  id: string;
  type: 'mutant' | 'anomaly' | 'artifact';
  name: string;
  photos: [string, string]; // Exactly 2 photos
  shortInfo: string;
  fullInfo: string;
  dangerLevel: 'низкий' | 'средний' | 'высокий' | 'смертельный';
  anomalyNames?: string[]; // For artifacts - list of anomalies
}

interface PDAModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PDAModal({ isOpen, onClose }: PDAModalProps) {
  const [pdaMode, setPdaMode] = useState<'menu' | 'database' | 'bestiary'>('menu');
  
  // Database states
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editForm, setEditForm] = useState<Character | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tasksExpanded, setTasksExpanded] = useState(false);
  const [editTasksExpanded, setEditTasksExpanded] = useState(false);
  const [expandedShortInfo, setExpandedShortInfo] = useState<string | null>(null);
  
  // Bestiary states
  const [bestiaryEntries, setBestiaryEntries] = useState<BestiaryEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<BestiaryEntry | null>(null);
  const [bestiaryFilter, setBestiaryFilter] = useState<'all' | 'mutant' | 'anomaly' | 'artifact'>('all');
  const [bestiarySearch, setBestiarySearch] = useState('');
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [isEditingBestiary, setIsEditingBestiary] = useState(false);
  const [bestiaryEditForm, setBestiaryEditForm] = useState<BestiaryEntry | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photo1InputRef = useRef<HTMLInputElement>(null);
  const photo2InputRef = useRef<HTMLInputElement>(null);
  const allSoundRef = useRef<HTMLAudioElement>(null);
  const saveSoundRef = useRef<HTMLAudioElement>(null);

  const [showAnomalyDropdown, setShowAnomalyDropdown] = useState(false);

  const anomalyOptions = [
  "Тепловые",
  "Электрические",
  "Химические",
  "Гравитационные"
];

const [timestampInsertedMap, setTimestampInsertedMap] = useState({});


const generateTimestamp = () => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  return `[${day}.${month}.2009 | ${hours}:${minutes} (UTC+3:00)] - `;
};

const shortInfoTemplate = 
  "|Рост: ~\n" +
  "|Вес: ~\n" +
  "|Телосложение: ~\n" +
  "|Возраст:\n" +
  "|Особенности:\n";

const [shortInfoInsertedMap, setShortInfoInsertedMap] = useState({});


  const playAllSound = () => {
    if (allSoundRef.current) {
      allSoundRef.current.currentTime = 0;
      allSoundRef.current.play().catch(() => {});
    }
  };

  const playSaveSound = () => {
    if (saveSoundRef.current) {
      saveSoundRef.current.currentTime = 0;
      saveSoundRef.current.play().catch(() => {});
    }
  };

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (isEditing || isEditingBestiary) {
          playAllSound();
          setIsEditing(false);
          setIsCreating(false);
          setEditForm(null);
          setEditTasksExpanded(false);
          setIsEditingBestiary(false);
          setBestiaryEditForm(null);
        } else if (selectedCharacter || selectedEntry) {
          playAllSound();
          setSelectedCharacter(null);
          setSelectedEntry(null);
        } else if (pdaMode !== 'menu') {
          playAllSound();
          setPdaMode('menu');
        } else {
          playAllSound();
          onClose();
        }
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, isEditing, isEditingBestiary, selectedCharacter, selectedEntry, pdaMode]);

  // Load data from Supabase + realtime подписка
  useEffect(() => {
    // Если Supabase не инициализировался (например, нет env-переменных на Vercel) —
    // просто выходим, чтобы не ломать клиент.
    if (!supabase) {
      return;
    }

    let isMounted = true;

    const loadData = async () => {
      const [charactersRes, bestiaryRes] = await Promise.all([
        supabase.from('pda_characters').select('*').order('updated_at', { ascending: true }),
        supabase.from('bestiary_entries').select('*').order('updated_at', { ascending: true }),
      ]);

      if (charactersRes.error) {
        console.error('Failed to load pda_characters from Supabase:', charactersRes.error);
      } else if (isMounted && charactersRes.data) {
        const mapped: Character[] = charactersRes.data.map((row: any) => ({
          id: row.id,
          photo: row.photo,
          name: row.name,
          birthDate: row.birth_date ?? '',
          faction: row.faction ?? '',
          rank: row.rank ?? '',
          status: row.status ?? 'Неизвестен',
          shortInfo: row.short_info ?? '',
          fullInfo: row.full_info ?? '',
          notes: row.notes ?? '',
          tasks: (row.tasks ?? []) as Task[],
          caseNumber: row.case_number ?? '',
        }));
        setCharacters(mapped);
      }

      if (bestiaryRes.error) {
        console.error('Failed to load bestiary_entries from Supabase:', bestiaryRes.error);
      } else if (isMounted && bestiaryRes.data) {
        const mapped: BestiaryEntry[] = bestiaryRes.data.map((row: any) => ({
          id: row.id,
          type: row.type,
          name: row.name,
          photos: [row.photos?.[0] ?? '/icons/nodata.png', row.photos?.[1] ?? '/icons/nodata.png'],
          shortInfo: row.short_info ?? '',
          fullInfo: row.full_info ?? '',
          dangerLevel: row.danger_level ?? 'средний',
          anomalyNames: row.anomaly_names ?? [],
        }));
        setBestiaryEntries(mapped);
      }
    };

    loadData();

    const channel = supabase
      .channel('pda_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pda_characters' },
        () => loadData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bestiary_entries' },
        () => loadData()
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);


  const filteredCharacters = characters.filter(char => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      char.name.toLowerCase().includes(query) ||
      char.faction.toLowerCase().includes(query) ||
      char.rank.toLowerCase().includes(query) ||
      char.status.toLowerCase().includes(query) ||
      char.shortInfo.toLowerCase().includes(query) ||
      char.fullInfo.toLowerCase().includes(query) ||
      char.caseNumber.toLowerCase().includes(query)
    );
  });

  const filteredBestiary = bestiaryEntries.filter(entry => {
    // First filter by type
    const typeMatch = bestiaryFilter === 'all' || entry.type === bestiaryFilter;
    
    // Then filter by search
    if (!bestiarySearch) return typeMatch;
    const query = bestiarySearch.toLowerCase();
    const searchMatch = entry.name.toLowerCase().includes(query) ||
      entry.shortInfo.toLowerCase().includes(query) ||
      entry.fullInfo.toLowerCase().includes(query);
    
    return typeMatch && searchMatch;
  });

  // Database functions (existing character management)
  const createNewCharacter = () => {
    playAllSound();
    const newChar: Character = {
      id: `char-${Date.now()}`,
      photo: '/icons/nodata.png',
      name: '',
      birthDate: '',
      faction: '',
      rank: '',
      status: 'Неизвестен',
      shortInfo: '',
      fullInfo: '',
      notes: '',
      tasks: [],
      caseNumber: ''
    };
    setEditForm(newChar);
    setIsCreating(true);
    setIsEditing(true);
  };

  const startEdit = (char: Character) => {
    playAllSound();
    setEditForm({ ...char });
    setIsEditing(true);
  };

  const saveCharacter = () => {
    playSaveSound();
    if (!editForm) return;

    if (isCreating) {
      setCharacters(prev => [...prev, editForm]);
      setSelectedCharacter(editForm);
      setIsCreating(false);
    } else {
      setCharacters(prev => prev.map(c => c.id === editForm.id ? editForm : c));
      setSelectedCharacter(editForm);
    }

    if (supabase) {
      const payload = {
        id: editForm.id,
        photo: editForm.photo,
        name: editForm.name,
        birth_date: editForm.birthDate,
        faction: editForm.faction,
        rank: editForm.rank,
        status: editForm.status,
        short_info: editForm.shortInfo,
        full_info: editForm.fullInfo,
        notes: editForm.notes,
        case_number: editForm.caseNumber,
        tasks: editForm.tasks,
      };

      supabase
        .from('pda_characters')
        .upsert(payload, { onConflict: 'id' })
        .then(({ error }) => {
          if (error) {
            console.error('Failed to upsert pda_character in Supabase:', error);
          }
        });
    }

    setIsEditing(false);
    setEditForm(null);
    setEditTasksExpanded(false);
  };

  const deleteCharacter = (id: string) => {
    playAllSound();
    if (confirm('Удалить персонажа?')) {
      setCharacters(prev => prev.filter(c => c.id !== id));
      if (selectedCharacter?.id === id) {
        setSelectedCharacter(null);
      }

      if (supabase) {
        supabase
          .from('pda_characters')
          .delete()
          .eq('id', id)
          .then(({ error }) => {
            if (error) {
              console.error('Failed to delete pda_character from Supabase:', error);
            }
          });
      }
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    playAllSound();
    const file = e.target.files?.[0];
    if (file && editForm) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setEditForm({ ...editForm, photo: event.target.result as string });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePhotoURL = () => {
    playAllSound();
    const url = prompt('Введите URL фотографии:');
    if (url && editForm) {
      setEditForm({ ...editForm, photo: url });
    }
  };

  const addTask = () => {
    playAllSound();
    if (!editForm) return;
    const newTask: Task = {
      id: `task-${Date.now()}`,
      description: '',
      status: 'в работе'
    };
    setEditForm({
      ...editForm,
      tasks: [newTask, ...editForm.tasks]
    });
  };

  const updateTask = (taskId: string, updates: Partial<Task>) => {
    playAllSound();
    if (!editForm) return;
    setEditForm({
      ...editForm,
      tasks: editForm.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t)
    });
  };

  const deleteTask = (taskId: string) => {
    playAllSound();
    if (!editForm) return;
    setEditForm({
      ...editForm,
      tasks: editForm.tasks.filter(t => t.id !== taskId)
    });
  };

  // Bestiary functions
  const createNewEntry = () => {
    playAllSound();
    const newEntry: BestiaryEntry = {
      id: `entry-${Date.now()}`,
      type: 'mutant',
      name: '',
      photos: ['/icons/nodata.png', '/icons/nodata.png'],
      shortInfo: '',
      fullInfo: '',
      dangerLevel: 'средний',
      anomalyNames: []
    };
    setBestiaryEditForm(newEntry);
    setIsEditingBestiary(true);
  };

  const editEntry = (entry: BestiaryEntry) => {
    playAllSound();
    setBestiaryEditForm({ ...entry, anomalyNames: entry.anomalyNames || [] });
    setIsEditingBestiary(true);
  };

  const saveBestiaryEntry = () => {
    playSaveSound();
    if (!bestiaryEditForm) return;

    const existing = bestiaryEntries.find(e => e.id === bestiaryEditForm.id);
    if (existing) {
      setBestiaryEntries(prev => prev.map(e => e.id === bestiaryEditForm.id ? bestiaryEditForm : e));
      setSelectedEntry(bestiaryEditForm);
    } else {
      setBestiaryEntries(prev => [...prev, bestiaryEditForm]);
    }

    if (supabase) {
      const payload = {
        id: bestiaryEditForm.id,
        type: bestiaryEditForm.type,
        name: bestiaryEditForm.name,
        photos: bestiaryEditForm.photos,
        short_info: bestiaryEditForm.shortInfo,
        full_info: bestiaryEditForm.fullInfo,
        danger_level: bestiaryEditForm.dangerLevel,
        anomaly_names: bestiaryEditForm.anomalyNames ?? [],
      };

      supabase
        .from('bestiary_entries')
        .upsert(payload, { onConflict: 'id' })
        .then(({ error }) => {
          if (error) {
            console.error('Failed to upsert bestiary_entry in Supabase:', error);
          }
        });
    }

    setIsEditingBestiary(false);
    setBestiaryEditForm(null);
  };

  const deleteBestiaryEntry = (id: string) => {
    playAllSound();
    if (confirm('Удалить запись?')) {
      setBestiaryEntries(prev => prev.filter(e => e.id !== id));
      if (selectedEntry?.id === id) {
        setSelectedEntry(null);
      }

      if (supabase) {
        supabase
          .from('bestiary_entries')
          .delete()
          .eq('id', id)
          .then(({ error }) => {
            if (error) {
              console.error('Failed to delete bestiary_entry from Supabase:', error);
            }
          });
      }
    }
  };

  const handleBestiaryPhotoChange = (index: 0 | 1, e: React.ChangeEvent<HTMLInputElement>) => {
    playAllSound();
    const file = e.target.files?.[0];
    if (file && bestiaryEditForm) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const newPhotos: [string, string] = [...bestiaryEditForm.photos] as [string, string];
          newPhotos[index] = event.target.result as string;
          setBestiaryEditForm({ ...bestiaryEditForm, photos: newPhotos });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBestiaryPhotoURL = (index: 0 | 1) => {
    playAllSound();
    const url = prompt('Введите URL фотографии:');
    if (url && bestiaryEditForm) {
      const newPhotos: [string, string] = [...bestiaryEditForm.photos] as [string, string];
      newPhotos[index] = url;
      setBestiaryEditForm({ ...bestiaryEditForm, photos: newPhotos });
    }
  };

  const addAnomalyName = () => {
    playAllSound();
    const name = prompt('Введите название аномалии:');
    if (name && bestiaryEditForm) {
      const anomalyNames = bestiaryEditForm.anomalyNames || [];
      setBestiaryEditForm({ ...bestiaryEditForm, anomalyNames: [...anomalyNames, name] });
    }
  };

  const removeAnomalyName = (index: number) => {
    playAllSound();
    if (bestiaryEditForm && bestiaryEditForm.anomalyNames) {
      const anomalyNames = bestiaryEditForm.anomalyNames.filter((_, i) => i !== index);
      setBestiaryEditForm({ ...bestiaryEditForm, anomalyNames });
    }
  };

  const getTaskStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'в работе': return 'bg-yellow-500/20 border-yellow-500 text-yellow-400';
      case 'провалено': return 'bg-red-500/20 border-red-500 text-red-400';
      case 'выполнено': return 'bg-gray-500/20 border-gray-400 text-gray-300';
    }
  };

  const getActiveTasks = (char: Character) => {
    return char.tasks.filter(t => t.status === 'в работе');
  };

  const getCompletedTasks = (char: Character) => {
    return char.tasks.filter(t => t.status !== 'в работе');
  };

  const hasActiveTask = (char: Character) => {
    return char.tasks.some(t => t.status === 'в работе');
  };

  const getStatusDotColor = (status: string) => {
    switch (status) {
      case 'Активен': return 'bg-gray-400';
      case 'Пропал': return 'bg-yellow-500';
      case 'Мертв': return 'bg-black-500';
      case 'В розыске': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getTaskPlaceholder = (status: Task['status']) => {
    switch (status) {
      case 'в работе': return 'Введите выданную задачу и награду';
      case 'провалено': return 'Введите выданную задачу и причину провала';
      case 'выполнено': return 'Введите выданную задачу и выплаченную награду';
    }
  };

  const getDangerColor = (level: BestiaryEntry['dangerLevel']) => {
    switch (level) {
      case 'низкий': return 'text-green-400 border-green-500';
      case 'средний': return 'text-yellow-400 border-yellow-500';
      case 'высокий': return 'text-orange-400 border-orange-500';
      case 'смертельный': return 'text-red-400 border-red-500';
    }
  };

const getTypeIcon = (type: BestiaryEntry['type']) => {
  switch (type) {
    case 'mutant': return '/icons/mutant.png';
    case 'anomaly': return '/icons/anomaly.png';
    case 'artifact': return '/icons/artifact.png';
  }
};

  const getTypeName = (type: BestiaryEntry['type']) => {
    switch (type) {
      case 'mutant': return 'МУТАНТ';
      case 'anomaly': return 'АНОМАЛИЯ';
      case 'artifact': return 'АРТЕФАКТ';
    }
  };

  const getTypeColor = (type: BestiaryEntry['type']) => {
    switch (type) {
      case 'mutant': return 'border-red-600 text-red-400';
      case 'anomaly': return 'border-orange-600 text-orange-400';
      case 'artifact': return 'border-blue-600 text-blue-400';
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <audio ref={allSoundRef} src="/media/sounds/all.mp3" />
      <audio ref={saveSoundRef} src="/media/sounds/save.mp3" />

      <div className="w-full h-full bg-transparent flex items-center justify-center relative pointer-events-none">
        <div className="w-[85%] h-[85%] bg-[#0a0a0a] border border-[#2a2a2a] overflow-hidden flex flex-col pointer-events-auto rounded-sm">
          {/* Header */}
          <div className="bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a] h-10 px-4 flex items-center justify-between border-b border-[#3a3a3a] flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse"></div>
              <span className="text-gray-400 text-xs font-mono tracking-wider">
                {pdaMode === 'menu' ? 'ГЛАВНОЕ МЕНЮ' : pdaMode === 'database' ? 'БАЗА ДАННЫХ' : 'БЕСТИАРИЙ'}
              </span>
            </div>
            <button 
              className="w-7 h-7 bg-red-900/30 border border-red-800 rounded hover:bg-red-900/50 transition-all flex items-center justify-center"
              onClick={() => {
                playAllSound();
                if (pdaMode !== 'menu') {
                  setPdaMode('menu');
                } else {
                  onClose();
                }
              }}
            >
              {pdaMode !== 'menu' ? <ChevronLeft className="w-4 h-4 text-gray-400" /> : <X className="w-4 h-4 text-red-500" />}
            </button>
          </div>

          {/* Menu Mode */}
          {pdaMode === 'menu' && (
            <div className="flex-1 flex">
              {/* Left - Database */}
              <div 
                className="flex-1 bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a] border-r border-[#2a2a2a] cursor-pointer hover:from-[#1a1a1a] hover:to-[#2a2a2a] transition-all flex flex-col items-center justify-center gap-4"
                onClick={() => {
                  playAllSound();
                  setPdaMode('database');
                }}
              >
                <Database className="w-16 h-16 text-gray-400" />
                <div className="text-gray-300 font-mono text-lg">БАЗА ДАННЫХ</div>
                <div className="text-gray-600 font-mono text-xs">Персонажи и контакты</div>
                <div className="text-gray-500 font-mono text-xs bg-[#1a1a1a] px-3 py-1 rounded border border-[#2a2a2a]">
                  {characters.length} записей
                </div>
              </div>

              {/* Right - Bestiary */}
              <div 
                className="flex-1 bg-gradient-to-bl from-[#0a0a0a] to-[#1a1a1a] cursor-pointer hover:from-[#1a1a1a] hover:to-[#2a2a2a] transition-all flex flex-col items-center justify-center gap-4"
                onClick={() => {
                  playAllSound();
                  setPdaMode('bestiary');
                }}
              >
                <BookOpen className="w-16 h-16 text-gray-400" />
                <div className="text-gray-300 font-mono text-lg">БЕСТИАРИЙ</div>
                <div className="text-gray-600 font-mono text-xs">Мутанты, аномалии, артефакты</div>
                <div className="text-gray-500 font-mono text-xs bg-[#1a1a1a] px-3 py-1 rounded border border-[#2a2a2a]">
                  {bestiaryEntries.length} записей
                </div>
              </div>
            </div>
          )}

          {/* Database Mode - List View */}
          {pdaMode === 'database' && !selectedCharacter && !isEditing && (
            <div className="flex-1 flex flex-col overflow-hidden bg-[#050505]">
              <div className="p-3 border-b border-[#2a2a2a] flex items-center gap-2 flex-shrink-0">
                <Search className="w-4 h-4 text-gray-600" />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    playAllSound();
                    setSearchQuery(e.target.value);
                  }}
                  placeholder="Поиск..."
                  className="flex-1 bg-transparent border-none text-gray-400 font-mono text-xs placeholder:text-gray-700 focus:outline-none"
                />
              </div>

              <div className="flex-1 overflow-y-auto pda-scrollbar p-3">
                <div className="grid grid-cols-2 gap-3">
                  {filteredCharacters.map(char => (
                    
<div
  key={char.id}
  className={`
    p-3 border cursor-pointer transition-all rounded flex flex-col gap-2 relative
    ${char.status === 'В розыске'
      ? 'bg-red-900/20 border-red-700 hover:bg-red-900/30'
      : 'bg-[#0a0a0a] border-[#2a2a2a] hover:bg-[#0f0f0f] hover:border-[#3a3a3a]'
    }
  `}
  onClick={() => {
    playAllSound();
    setSelectedCharacter(char);
  }}
>


                      {hasActiveTask(char) && (
                        <div className="absolute top-25 right-3 z-10">
                          <div className="text-[9px] font-mono px-2 py-1 rounded border border-yellow-500 text-yellow-400 bg-yellow-500/20 flex items-center gap-1">
                            <span>задача</span>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-3">
                        <div className="flex-shrink-0 relative">
                          <img 
                            src={char.photo} 
                            alt={char.name}
                            className="w-20 h-28 object-cover rounded border border-[#2a2a2a]"
                          />
                          <div className="absolute top-1 left-0 right-0 flex justify-center">
                            <div className="flex items-center gap-1 px-2 py-1 rounded bg-black/70">
                              <div className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(char.status)}`}></div>
                              <span className="text-gray-300 font-mono text-[9px]">{char.status}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col">
                          <div className="text-gray-300 font-mono text-lg mb-1 truncate">{char.name}</div>
                            <div className="text-gray-300 font-mono text-base mb-0 truncate">
                            {char.faction}
                          </div>
             
                          <div className="text-gray-500 font-mono text-xs mb-3 truncate">
                            {char.rank}
                          </div>
                             <div className="text-gray-400 font-mono text-xs mb-1 truncate">
                            {char.birthDate}
                          </div>
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
                        <div className={`text-gray-500 font-mono text-xs break-words ${
                          expandedShortInfo === char.id ? '' : 'line-clamp-2'
                        }`}>
                          {char.shortInfo}
                        </div>
                        {char.shortInfo.length > 60 && (
                          <div className="text-gray-600 font-mono text-[8px] mt-1 text-right">
                            {expandedShortInfo === char.id ? '▲ Скрыть' : '▼ Показать'}
                          </div>
                        )}
                        
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={createNewCharacter}
                className="p-3 bg-[#2a2a2a] border-t border-[#3a3a3a] hover:bg-[#3a3a3a] transition-all flex items-center justify-center gap-2 text-gray-400 font-mono text-xs flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
                ДОБАВИТЬ
              </button>
            </div>
          )}

          {/* Database Detail View - continues on next comment due to length */}
{/* Character Detail View */}
{pdaMode === 'database' && selectedCharacter && !isEditing && (
  <div className="flex-1 flex flex-col overflow-hidden bg-[#050505]">
    <div className="p-3 border-b border-[#2a2a2a] flex-shrink-0">
      <button
        onClick={() => {
          playAllSound();
          setSelectedCharacter(null);
        }}
        className="px-3 py-1.5 bg-[#2a2a2a] border border-[#3a3a3a] rounded hover:bg-[#3a3a3a] transition-all flex items-center gap-1 text-gray-400 font-mono text-xs"
      >
        <ChevronLeft className="w-4 h-4" />
        НАЗАД
      </button>
    </div>

    <div className="flex-1 overflow-y-auto pda-scrollbar p-4">
      <div className="flex gap-5">
        <div className="flex-shrink-0 flex flex-col items-center">
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => startEdit(selectedCharacter)}
              className="px-3 py-1.5 bg-[#2a2a2a] border border-[#3a3a3a] rounded hover:bg-[#3a3a3a] transition-all flex items-center justify-center gap-1 text-gray-400 font-mono text-[10px]"
            >
              <Edit2 className="w-3 h-3" />
              ИЗМЕНИТЬ
            </button>
            <button
              onClick={() => deleteCharacter(selectedCharacter.id)}
              className="px-3 py-1.5 bg-red-900/20 border border-red-800 rounded hover:bg-red-900/40 transition-all text-red-500 font-mono text-[10px]"
            >
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

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3 border-b border-[#2a2a2a] pb-2">
            <h2 className="text-lg font-mono text-gray-300 break-words flex-1">
              {selectedCharacter.name}
            </h2>
            {selectedCharacter.caseNumber && (
              <div className="text-gray-400 font-mono text-base ml-3 flex-shrink-0">
                {selectedCharacter.caseNumber}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded">
              <div className="text-gray-500 text-[10px] font-mono mb-2">КРАТКАЯ ИНФОРМАЦИЯ</div>
              <div className="text-gray-300 text-[11px] break-words whitespace-pre-wrap">{selectedCharacter.shortInfo}</div>
            </div>

            {selectedCharacter.tasks.length > 0 && (
              <div className="p-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded">
                <button
                  onClick={() => {
                    playAllSound();
                    setTasksExpanded(!tasksExpanded);
                  }}
                  className="w-full flex items-center justify-between text-gray-500 text-[10px] font-mono mb-2 hover:text-gray-400 transition-colors"
                >
                  <span>ЗАДАЧИ ({selectedCharacter.tasks.length})</span>
                  {tasksExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {(() => {
                  const activeTasks = getActiveTasks(selectedCharacter);
                  const completedTasks = getCompletedTasks(selectedCharacter);
                  
                  return (
                    <div className="space-y-2 mt-2">
                      {activeTasks.map(task => (
                        <div key={task.id} className="p-2 bg-[#050505] border border-[#2a2a2a] rounded relative">
                          <div className="absolute top-2 right-2">
                            <div className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${getTaskStatusColor(task.status)}`}>
                              {task.status}
                            </div>
                          </div>
                          <div className="text-gray-300 text-[11px] pr-20 break-words whitespace-pre-wrap">{task.description || 'Без описания'}</div>
                        </div>
                      ))}

                      {tasksExpanded && completedTasks.map(task => (
                        <div key={task.id} className="p-2 bg-[#050505] border border-[#2a2a2a] rounded relative">
                          <div className="absolute top-2 right-2">
                            <div className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${getTaskStatusColor(task.status)}`}>
                              {task.status}
                            </div>
                          </div>
                          <div className="text-gray-300 text-[11px] pr-20 break-words whitespace-pre-wrap">{task.description || 'Без описания'}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="p-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded">
              <div className="text-gray-500 text-[10px] font-mono mb-2">ПОЛНАЯ ИНФОРМАЦИЯ</div>
              <div className="text-gray-300 text-[11px] break-words whitespace-pre-wrap">{selectedCharacter.fullInfo}</div>
            </div>

            {selectedCharacter.notes && (
              <div className="p-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded">
                <div className="text-gray-500 text-[10px] font-mono mb-2">ЗАМЕТКИ</div>
                <div className="text-gray-300 text-[11px] break-words whitespace-pre-wrap">{selectedCharacter.notes}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
)}

{/* Character Edit Mode - skipping for brevity, keeping existing code */}
{pdaMode === 'database' && isEditing && editForm && (
  <div className="flex-1 flex flex-col overflow-hidden bg-[#050505]">
    <div className="p-3 border-b border-[#2a2a2a] flex items-center justify-between flex-shrink-0">
      <h2 className="text-sm font-mono text-gray-400">
        {isCreating ? 'НОВЫЙ ПЕРСОНАЖ' : 'РЕДАКТИРОВАНИЕ'}
      </h2>
      <div className="flex gap-2">
        <button
          onClick={() => {
            playAllSound();
            setIsEditing(false);
            setIsCreating(false);
            setEditForm(null);
            setEditTasksExpanded(false);
          }}
          className="px-3 py-1.5 bg-[#2a2a2a] border border-[#3a3a3a] rounded hover:bg-[#3a3a3a] transition-all text-gray-400 font-mono text-xs"
        >
          ОТМЕНА
        </button>
        <button
          onClick={saveCharacter}
          className="px-3 py-1.5 bg-gray-700/30 border border-gray-600 rounded hover:bg-gray-700/50 transition-all flex items-center gap-1 text-gray-300 font-mono text-xs"
        >
          <Save className="w-4 h-4" />
          СОХРАНИТЬ
        </button>
      </div>
    </div>

    <div className="flex-1 overflow-y-auto pda-scrollbar p-4">
      <div className="flex gap-4">
        <div className="flex-shrink-0">
          <div className="mb-3">
            <label className="block text-gray-500 text-[10px] font-mono mb-1 text-center">НОМЕР ДЕЛА</label>
            <input 
              type="text"
              value={editForm.caseNumber}
              onChange={(e) => {
                playAllSound();
                setEditForm({...editForm, caseNumber: e.target.value});
              }}
              placeholder="88005553535"
              className="w-40 p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-gray-400 font-mono text-xs focus:border-[#3a3a3a] focus:outline-none text-center placeholder:text-gray-700"
            />
          </div>

          <img 
            src={editForm.photo}
            alt="Preview"
            className="w-40 h-56 object-cover rounded border border-[#2a2a2a] mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                playAllSound();
                fileInputRef.current?.click();
              }}
              className="flex-1 px-3 py-1.5 bg-[#2a2a2a] border border-[#3a3a3a] rounded hover:bg-[#3a3a3a] transition-all text-gray-400 font-mono text-[10px]"
            >
              ФАЙЛ
            </button>
            <button
              onClick={handlePhotoURL}
              className="flex-1 px-3 py-1.5 bg-[#2a2a2a] border border-[#3a3a3a] rounded hover:bg-[#3a3a3a] transition-all text-gray-400 font-mono text-[10px]"
            >
              URL
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-3">
          <div>
            <label className="block text-gray-500 text-[10px] font-mono mb-1">ФИО</label>
            <input 
              type="text"
              value={editForm.name}
              onChange={(e) => {
                playAllSound();
                setEditForm({...editForm, name: e.target.value});
              }}
              placeholder="Иванов Иван Иванович"
              className="w-full p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-gray-400 font-mono text-xs focus:border-[#3a3a3a] focus:outline-none placeholder:text-gray-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-500 text-[10px] font-mono mb-1">ДАТА РОЖДЕНИЯ</label>
              <input 
                type="text"
                value={editForm.birthDate}
                onChange={(e) => {
                  playAllSound();
                  setEditForm({...editForm, birthDate: e.target.value});
                }}
                placeholder="ДД.ММ.ГГГГ"
                className="w-full p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-gray-400 font-mono text-xs focus:border-[#3a3a3a] focus:outline-none placeholder:text-gray-700"
              />
            </div>
            <div>
              <label className="block text-gray-500 text-[10px] font-mono mb-1">СТАТУС</label>
              <select
                value={editForm.status}
                onChange={(e) => {
                  playAllSound();
                  setEditForm({...editForm, status: e.target.value});
                }}
                className="w-full p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-gray-400 font-mono text-xs focus:border-[#3a3a3a] focus:outline-none"
              >
                <option>Активен</option>
                <option>Пропал</option>
                <option>Неизвестен</option>
                <option>Мертв</option>
                <option>В розыске</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-500 text-[10px] font-mono mb-1">ГРУППИРОВКА</label>
              <input 
                type="text"
                value={editForm.faction}
                onChange={(e) => {
                  playAllSound();
                  setEditForm({...editForm, faction: e.target.value});
                }}
                placeholder="Чистое Небо"
                className="w-full p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-gray-400 font-mono text-xs focus:border-[#3a3a3a] focus:outline-none placeholder:text-gray-700"
              />
            </div>
            <div>
              <label className="block text-gray-500 text-[10px] font-mono mb-1">ЗВАНИЕ</label>
              <input 
                type="text"
                value={editForm.rank}
                onChange={(e) => {
                  playAllSound();
                  setEditForm({...editForm, rank: e.target.value});
                }}
                placeholder="Новичок/Сержант"
                className="w-full p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-gray-400 font-mono text-xs focus:border-[#3a3a3a] focus:outline-none placeholder:text-gray-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-500 text-[10px] font-mono mb-1">КРАТКАЯ ИНФОРМАЦИЯ</label>
<textarea
  value={editForm.shortInfo}
  onChange={(e) => {
    playAllSound();

    let value = e.target.value;

    // Вставляем шаблон только один раз для этого персонажа
    if (!shortInfoInsertedMap[editForm.id]) {
      value = shortInfoTemplate + value;

      setShortInfoInsertedMap(prev => ({
        ...prev,
        [editForm.id]: true
      }));
    }

    setEditForm({
      ...editForm,
      shortInfo: value
    });
  }}
  placeholder="Краткая информация"
  rows={6} // ← УВЕЛИЧИВАЕТ ВЫСОТУ
  className="w-full p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-gray-400 font-mono text-xs focus:border-[#3a3a3a] focus:outline-none resize-none placeholder:text-gray-700"
/>



          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => {
                  playAllSound();
                  setEditTasksExpanded(!editTasksExpanded);
                }}
                className="flex items-center gap-1 text-gray-500 text-[10px] font-mono hover:text-gray-400"
              >
                ЗАДАЧИ ({editForm.tasks.length})
                {editTasksExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <button
                onClick={addTask}
                className="px-3 py-1 bg-[#2a2a2a] border border-[#3a3a3a] rounded hover:bg-[#3a3a3a] transition-all text-gray-400 font-mono text-[10px] flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Добавить
              </button>
            </div>
            
            {editTasksExpanded && (
              <div className="space-y-2 p-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded max-h-72 overflow-y-auto pda-scrollbar">
                {editForm.tasks.map(task => (
                  <div key={task.id} className="p-2 bg-[#050505] border border-[#2a2a2a] rounded">
                    <div className="flex items-start gap-2 mb-2">
                      <select
                        value={task.status}
                        onChange={(e) => updateTask(task.id, { status: e.target.value as Task['status'] })}
                        className="flex-shrink-0 p-1.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-gray-400 font-mono text-[10px] focus:border-[#3a3a3a] focus:outline-none"
                      >
                        <option value="в работе">в работе</option>
                        <option value="провалено">провалено</option>
                        <option value="выполнено">выполнено</option>
                      </select>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="flex-shrink-0 p-1.5 bg-red-900/20 border border-red-800 rounded hover:bg-red-900/40 transition-all"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
<textarea
  value={task.description}
  onChange={(e) => {
  playAllSound();

  let value = e.target.value;

  if (!timestampInsertedMap[task.id]) {
    value = generateTimestamp() + value;

    setTimestampInsertedMap(prev => ({
      ...prev,
      [task.id]: true
    }));
  }

  updateTask(task.id, { description: value });
}}

  placeholder={getTaskPlaceholder(task.status)}
  className="w-full p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-gray-400 font-mono text-[11px] focus:border-[#3a3a3a] focus:outline-none resize-none placeholder:text-gray-700"
/>

                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-gray-500 text-[10px] font-mono mb-1">ПОЛНАЯ ИНФОРМАЦИЯ</label>
            <textarea 
              value={editForm.fullInfo}
              onChange={(e) => {
                playAllSound();
                setEditForm({...editForm, fullInfo: e.target.value});
              }}
              placeholder="Введите  всю имеющуюся  информацию на данный субъект"
              rows={6}
              className="w-full p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-gray-400 font-mono text-xs focus:border-[#3a3a3a] focus:outline-none resize-none placeholder:text-gray-700"
            />
          </div>

          <div>
            <label className="block text-gray-500 text-[10px] font-mono mb-1">ЗАМЕТКИ</label>
            <textarea 
              value={editForm.notes}
              onChange={(e) => {
                playAllSound();
                setEditForm({...editForm, notes: e.target.value});
              }}
              placeholder="Введите  свои заметки на данного субъекта"
              rows={4}
              className="w-full p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-gray-400 font-mono text-xs focus:border-[#3a3a3a] focus:outline-none resize-none placeholder:text-gray-700"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
)}

{/* Bestiary Mode - List View with Search */}
{pdaMode === 'bestiary' && !selectedEntry && !isEditingBestiary && (
  <div className="flex-1 flex flex-col overflow-hidden bg-[#050505]">
    <div className="p-3 border-b border-[#2a2a2a] flex-shrink-0 space-y-3">
      <div className="flex items-center gap-2">
<button
  onClick={() => {
    playAllSound();
    setBestiaryFilter('all');
  }}
  className={`px-3 py-1 rounded text-xs font-mono transition-all ${
    bestiaryFilter === 'all'
      ? 'bg-[#2a2a2a] text-gray-300 border border-[#3a3a3a]'
      : 'bg-transparent text-gray-600 hover:text-gray-400'
  }`}
>
  ВСЕ
</button>
<button
  onClick={() => {
    playAllSound();
    setBestiaryFilter('mutant');
  }}
  className={`px-3 py-1 rounded text-xs font-mono transition-all flex items-center gap-1 ${
    bestiaryFilter === 'mutant'
      ? 'bg-[#2a2a2a] text-gray-300 border border-[#3a3a3a]'
      : 'bg-transparent text-gray-600 hover:text-gray-400'
  }`}
>
  <img 
    src={getTypeIcon('mutant')} 
    alt="mutant" 
    className="w-4 h-4"
  />
  МУТАНТЫ
</button>

<button
  onClick={() => {
    playAllSound();
    setBestiaryFilter('anomaly');
  }}
  className={`px-3 py-1 rounded text-xs font-mono transition-all flex items-center gap-1 ${
    bestiaryFilter === 'anomaly'
      ? 'bg-[#2a2a2a] text-gray-300 border border-[#3a3a3a]'
      : 'bg-transparent text-gray-600 hover:text-gray-400'
  }`}
>
  <img 
    src={getTypeIcon('anomaly')} 
    alt="anomaly" 
    className="w-4 h-4"
  />
  АНОМАЛИИ
</button>

<button
  onClick={() => {
    playAllSound();
    setBestiaryFilter('artifact');
  }}
  className={`px-3 py-1 rounded text-xs font-mono transition-all flex items-center gap-1 ${
    bestiaryFilter === 'artifact'
      ? 'bg-[#2a2a2a] text-gray-300 border border-[#3a3a3a]'
      : 'bg-transparent text-gray-600 hover:text-gray-400'
  }`}
>
  <img 
    src={getTypeIcon('artifact')} 
    alt="artifact" 
    className="w-4 h-4"
  />
  АРТЕФАКТЫ
</button>

      </div>
      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-gray-600" />


      </div>
    </div>

    <div className="flex-1 overflow-y-auto pda-scrollbar p-3">
      <div className="space-y-3">
        {filteredBestiary.map(entry => (
          <div
            key={entry.id}
            className="p-3 border border-[#2a2a2a] cursor-pointer transition-all hover:bg-[#0f0f0f] hover:border-[#3a3a3a] rounded"
onClick={() => {
  playAllSound();
  setSelectedEntry(entry);
}}
          >
            <div className="flex gap-3">
              {/* Photos */}
              <div className="flex-shrink-0 flex gap-2">
                <img 
                  src={entry.photos[0]} 
                  alt={entry.name}
                  className="w-24 h-32 object-cover rounded border border-[#2a2a2a]"
                />
                <img 
                  src={entry.photos[1]} 
                  alt={entry.name}
                  className="w-24 h-32 object-cover rounded border border-[#2a2a2a]"
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                <img 
                  src={getTypeIcon(entry.type)} 
                  alt={entry.type} 
                  className="w-5 h-5"
                />
                <div className="text-gray-300 font-mono text-lg font-bold">{entry.name}</div>
              </div>
{entry.type === 'artifact' && entry.anomalyNames && entry.anomalyNames.length > 0 && (
  <div className="mt-2 flex flex-wrap gap-1">
    {entry.anomalyNames.map((name, index) => {
      let colorClass = "";

      switch (name) {
        case "Электрические":
          colorClass = "bg-blue-900/40 border-blue-500 text-blue-300";
          break;
        case "Гравитационные":
          colorClass = "bg-amber-900/40 border-amber-700 text-amber-400";
          break;
        case "Тепловые":
          colorClass = "bg-red-900/40 border-red-600 text-red-400";
          break;
        case "Химические":
          colorClass = "bg-green-900/40 border-green-600 text-green-400";
          break;
        default:
          colorClass = "bg-[#1a1a1a] border-[#3a3a3a] text-gray-400";
      }

      return (
        <div
          key={index}
          className={`mb-2 px-2 py-0.5 rounded border font-mono text-[9px] ${colorClass}`}
        >
          {name}
        </div>
      );
    })}
  </div>
)}

                <div className="flex items-center gap-2 mb-2">
                  {entry.type !== 'artifact' && (
                    <div className={`text-[10px] font-mono px-2 py-0.5 rounded border ${getDangerColor(entry.dangerLevel)}`}>
                      ОПАСНОСТЬ: {entry.dangerLevel.toUpperCase()}
                    </div>
                  )}
                  <div className={`text-[10px] font-mono px-2 py-0.5 rounded border ${getTypeColor(entry.type)}`}>
                    {getTypeName(entry.type)}
                  </div>
                </div>

                <div 
                  className={`text-gray-500 font-mono text-xs break-words ${
                    expandedEntry === entry.id ? '' : 'line-clamp-3'
                  }`}
                >
                  {entry.shortInfo}
                </div>

                {entry.shortInfo.length > 100 && (
  <div
    className="text-gray-600 font-mono text-[8px] mt-1 text-right cursor-pointer"
    onClick={(e) => {
      e.stopPropagation();
      playAllSound();
      setExpandedEntry(expandedEntry === entry.id ? null : entry.id);
    }}
  >
    {expandedEntry === entry.id
      ? '▲ Скрыть | Кликните для деталей'
      : '▼ Показать | Кликните для деталей'}
  </div>
)}

              </div>
            </div>
          </div>
        ))}
      </div>
    </div>

    <button
      onClick={createNewEntry}
      className="p-3 bg-[#2a2a2a] border-t border-[#3a3a3a] hover:bg-[#3a3a3a] transition-all flex items-center justify-center gap-2 text-gray-400 font-mono text-xs flex-shrink-0"
    >
      <Plus className="w-4 h-4" />
      ДОБАВИТЬ ЗАПИСЬ
    </button>
  </div>
)}

{/* Bestiary Detail View */}
{pdaMode === 'bestiary' && selectedEntry && !isEditingBestiary && (
  <div className="flex-1 flex flex-col overflow-hidden bg-[#050505]">
    <div className="p-3 border-b border-[#2a2a2a] flex items-center justify-between flex-shrink-0">
      <button
        onClick={() => {
          playAllSound();
          setSelectedEntry(null);
        }}
        className="px-3 py-1.5 bg-[#2a2a2a] border border-[#3a3a3a] rounded hover:bg-[#3a3a3a] transition-all flex items-center gap-1 text-gray-400 font-mono text-xs"
      >
        <ChevronLeft className="w-4 h-4" />
        НАЗАД
      </button>
      <div className="flex gap-2">
        <button
          onClick={() => editEntry(selectedEntry)}
          className="px-3 py-1.5 bg-[#2a2a2a] border border-[#3a3a3a] rounded hover:bg-[#3a3a3a] transition-all flex items-center gap-1 text-gray-400 font-mono text-xs"
        >
          <Edit2 className="w-3 h-3" />
          ИЗМЕНИТЬ
        </button>
        <button
          onClick={() => deleteBestiaryEntry(selectedEntry.id)}
          className="px-3 py-1.5 bg-red-900/20 border border-red-800 rounded hover:bg-red-900/40 transition-all text-red-500 font-mono text-xs"
        >
          УДАЛИТЬ
        </button>
      </div>
    </div>

    <div className="flex-1 overflow-y-auto pda-scrollbar p-4">
      <div className="flex items-center gap-3 mb-4">
        <img 
  src={getTypeIcon(selectedEntry.type)} 
  alt={selectedEntry.type} 
  className="w-6 h-6"
/>

        <div>
          <h2 className="text-xl font-mono text-gray-300 font-bold">{selectedEntry.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            {selectedEntry.type !== 'artifact' && (
              <div className={`text-[10px] font-mono px-2 py-0.5 rounded border ${getDangerColor(selectedEntry.dangerLevel)}`}>
                ОПАСНОСТЬ: {selectedEntry.dangerLevel.toUpperCase()}
              </div>
            )}
            <div className={`text-[10px] font-mono px-2 py-0.5 rounded border ${getTypeColor(selectedEntry.type)}`}>
              {getTypeName(selectedEntry.type)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <img 
          src={selectedEntry.photos[0]} 
          alt={selectedEntry.name}
          className="w-full h-auto object-contain rounded border border-[#2a2a2a]"
        />
        <img 
          src={selectedEntry.photos[1]} 
          alt={selectedEntry.name}
          className="w-full h-auto object-contain rounded border border-[#2a2a2a]"
        />
      </div>

      <div className="space-y-3">
        <div className="p-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded">
          <div className="text-gray-500 text-[10px] font-mono mb-2">КРАТКАЯ ИНФОРМАЦИЯ</div>
          <div className="text-gray-300 text-[11px] break-words whitespace-pre-wrap">{selectedEntry.shortInfo}</div>
        </div>

        <div className="p-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded">
          <div className="text-gray-500 text-[10px] font-mono mb-2">ПОЛНАЯ ИНФОРМАЦИЯ</div>
          <div className="text-gray-300 text-[11px] break-words whitespace-pre-wrap">{selectedEntry.fullInfo}</div>
        </div>

        {selectedEntry.type === 'artifact' && selectedEntry.anomalyNames && selectedEntry.anomalyNames.length > 0 && (
          <div className="p-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded">
            <div className="text-gray-500 text-[10px] font-mono mb-2">АНОМАЛИИ</div>
            <div className="flex flex-wrap gap-2">
              {selectedEntry.anomalyNames.map((anomalyName, index) => (
                <div key={index} className="px-2 py-1 bg-[#1a1a1a] border border-[#3a3a3a] rounded text-gray-400 font-mono text-xs">
                  {anomalyName}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
)}

{/* Bestiary Edit Mode */}
{pdaMode === 'bestiary' && isEditingBestiary && bestiaryEditForm && (
  <div className="flex-1 flex flex-col overflow-hidden bg-[#050505]">
    <div className="p-3 border-b border-[#2a2a2a] flex items-center justify-between flex-shrink-0">
      <h2 className="text-sm font-mono text-gray-400">
        {bestiaryEntries.find(e => e.id === bestiaryEditForm.id) ? 'РЕДАКТИРОВАНИЕ' : 'НОВАЯ ЗАПИСЬ'}
      </h2>
      <div className="flex gap-2">
        <button
          onClick={() => {
            playAllSound();
            setIsEditingBestiary(false);
            setBestiaryEditForm(null);
          }}
          className="px-3 py-1.5 bg-[#2a2a2a] border border-[#3a3a3a] rounded hover:bg-[#3a3a3a] transition-all text-gray-400 font-mono text-xs"
        >
          ОТМЕНА
        </button>
        <button
          onClick={saveBestiaryEntry}
          className="px-3 py-1.5 bg-gray-700/30 border border-gray-600 rounded hover:bg-gray-700/50 transition-all flex items-center gap-1 text-gray-300 font-mono text-xs"
        >
          <Save className="w-4 h-4" />
          СОХРАНИТЬ
        </button>
      </div>
    </div>

    <div className="flex-1 overflow-y-auto pda-scrollbar p-4">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-gray-500 text-[10px] font-mono mb-1">ФОТО 1</label>
            <img 
              src={bestiaryEditForm.photos[0]}
              alt="Preview 1"
              className="w-full h-auto object-contain rounded border border-[#2a2a2a] mb-2"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  playAllSound();
                  photo1InputRef.current?.click();
                }}
                className="flex-1 px-3 py-1.5 bg-[#2a2a2a] border border-[#3a3a3a] rounded hover:bg-[#3a3a3a] transition-all text-gray-400 font-mono text-[10px]"
              >
                ФАЙЛ
              </button>
              <button
                onClick={() => handleBestiaryPhotoURL(0)}
                className="flex-1 px-3 py-1.5 bg-[#2a2a2a] border border-[#3a3a3a] rounded hover:bg-[#3a3a3a] transition-all text-gray-400 font-mono text-[10px]"
              >
                URL
              </button>
            </div>
          </div>
          <div>
            <label className="block text-gray-500 text-[10px] font-mono mb-1">ФОТО 2</label>
            <img 
              src={bestiaryEditForm.photos[1]}
              alt="Preview 2"
              className="w-full h-auto object-contain rounded border border-[#2a2a2a] mb-2"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  playAllSound();
                  photo2InputRef.current?.click();
                }}
                className="flex-1 px-3 py-1.5 bg-[#2a2a2a] border border-[#3a3a3a] rounded hover:bg-[#3a3a3a] transition-all text-gray-400 font-mono text-[10px]"
              >
                ФАЙЛ
              </button>
              <button
                onClick={() => handleBestiaryPhotoURL(1)}
                className="flex-1 px-3 py-1.5 bg-[#2a2a2a] border border-[#3a3a3a] rounded hover:bg-[#3a3a3a] transition-all text-gray-400 font-mono text-[10px]"
              >
                URL
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-gray-500 text-[10px] font-mono mb-1">НАЗВАНИЕ</label>
          <input 
            type="text"
            value={bestiaryEditForm.name}
            onChange={(e) => {
              playAllSound();
              setBestiaryEditForm({...bestiaryEditForm, name: e.target.value});
            }}
            placeholder="Название мутанта/аномалии/артефакта"
            className="w-full p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-gray-400 font-mono text-xs focus:border-[#3a3a3a] focus:outline-none placeholder:text-gray-700"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-gray-500 text-[10px] font-mono mb-1">ТИП</label>
            <select
              value={bestiaryEditForm.type}
              onChange={(e) => {
                playAllSound();
                setBestiaryEditForm({...bestiaryEditForm, type: e.target.value as BestiaryEntry['type']});
              }}
              className="w-full p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-gray-400 font-mono text-xs focus:border-[#3a3a3a] focus:outline-none"
            >
              <option value="mutant">Мутант</option>
              <option value="anomaly">Аномалия</option>
              <option value="artifact">Артефакт</option>
            </select>
          </div>
          {bestiaryEditForm.type !== 'artifact' && (
            <div>
              <label className="block text-gray-500 text-[10px] font-mono mb-1">УРОВЕНЬ ОПАСНОСТИ</label>
              <select
                value={bestiaryEditForm.dangerLevel}
                onChange={(e) => {
                  playAllSound();
                  setBestiaryEditForm({...bestiaryEditForm, dangerLevel: e.target.value as BestiaryEntry['dangerLevel']});
                }}
                className="w-full p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-gray-400 font-mono text-xs focus:border-[#3a3a3a] focus:outline-none"
              >
                <option value="низкий">Низкий</option>
                <option value="средний">Средний</option>
                <option value="высокий">Высокий</option>
                <option value="смертельный">Смертельный</option>
              </select>
            </div>
          )}
          {bestiaryEditForm.type === 'artifact' && (
  <div>
    <label className="block text-gray-500 text-[10px] font-mono mb-1">
      СРЕДА ОБИТАНИЯ (АНОМАЛИИ)
    </label>

    {/* Выбранные аномалии */}
    <div className="flex flex-wrap gap-2 p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded min-h-[40px]">
      {bestiaryEditForm.anomalyNames?.map((name, index) => (
        <div
          key={index}
          className="flex items-center gap-1 px-2 py-1 bg-[#1a1a1a] border border-[#3a3a3a] rounded"
        >
          <span className="text-gray-400 font-mono text-xs">{name}</span>
          <button
            onClick={() => removeAnomalyName(index)}
            className="text-red-500 hover:text-red-400"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>

    {/* Выпадающий список */}
    <div className="relative mt-2">
      <button
        onClick={() => setShowAnomalyDropdown(prev => !prev)}
        className="w-full px-3 py-1.5 bg-[#2a2a2a] border border-[#3a3a3a] rounded text-gray-400 font-mono text-xs hover:bg-[#3a3a3a] transition-all"
      >
        Выбрать аномалии
      </button>

      {showAnomalyDropdown && (
        <div className="absolute z-10 mt-1 w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded shadow-lg p-2 flex flex-col gap-1">
          {anomalyOptions.map((option) => {
            const isSelected = bestiaryEditForm.anomalyNames.includes(option);

            return (
              <div
                key={option}
                onClick={() => {
                  playAllSound();
                  if (isSelected) {
                    setBestiaryEditForm({
                      ...bestiaryEditForm,
                      anomalyNames: bestiaryEditForm.anomalyNames.filter(a => a !== option)
                    });
                  } else {
                    setBestiaryEditForm({
                      ...bestiaryEditForm,
                      anomalyNames: [...bestiaryEditForm.anomalyNames, option]
                    });
                  }
                }}
                className={`px-2 py-1 rounded cursor-pointer font-mono text-xs ${
                  isSelected
                    ? "bg-[#2a2a2a] text-gray-300 border border-[#3a3a3a]"
                    : "text-gray-500 hover:bg-[#1a1a1a]"
                }`}
              >
                {option}
              </div>
            );
          })}
        </div>
      )}
    </div>
  </div>
)}

        </div>

        <div>
          <label className="block text-gray-500 text-[10px] font-mono mb-1">КРАТКАЯ ИНФОРМАЦИЯ</label>
          <textarea 
            value={bestiaryEditForm.shortInfo}
            onChange={(e) => {
              playAllSound();
              setBestiaryEditForm({...bestiaryEditForm, shortInfo: e.target.value});
            }}
            placeholder="Введите краткое описание"
            rows={4}
            className="w-full p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-gray-400 font-mono text-xs focus:border-[#3a3a3a] focus:outline-none resize-none placeholder:text-gray-700"
          />
        </div>

        <div>
          <label className="block text-gray-500 text-[10px] font-mono mb-1">ПОЛНАЯ ИНФОРМАЦИЯ</label>
          <textarea 
            value={bestiaryEditForm.fullInfo}
            onChange={(e) => {
              playAllSound();
              setBestiaryEditForm({...bestiaryEditForm, fullInfo: e.target.value});
            }}
            placeholder="Введите полное описание, особенности, способы борьбы и т.д."
            rows={8}
            className="w-full p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-gray-400 font-mono text-xs focus:border-[#3a3a3a] focus:outline-none resize-none placeholder:text-gray-700"
          />
        </div>
      </div>
    </div>
  </div>
)}
        </div>

        <input 
          ref={fileInputRef}
          type="file"
          onChange={handlePhotoChange}
          className="hidden"
          accept="image/*"
        />
        <input 
          ref={photo1InputRef}
          type="file"
          onChange={(e) => handleBestiaryPhotoChange(0, e)}
          className="hidden"
          accept="image/*"
        />
        <input 
          ref={photo2InputRef}
          type="file"
          onChange={(e) => handleBestiaryPhotoChange(1, e)}
          className="hidden"
          accept="image/*"
        />

        <style>
          {`
            .pda-scrollbar::-webkit-scrollbar {
              width: 10px;
            }
            .pda-scrollbar::-webkit-scrollbar-track {
              background: #0a0a0a;
              border-left: 1px solid #2a2a2a;
              border-radius: 5px;
            }
            .pda-scrollbar::-webkit-scrollbar-thumb {
              background: linear-gradient(180deg, #4a4a4a 0%, #3a3a3a 100%);
              border-radius: 5px;
              border: 1px solid #2a2a2a;
            }
            .pda-scrollbar::-webkit-scrollbar-thumb:hover {
              background: linear-gradient(180deg, #5a5a5a 0%, #4a4a4a 100%);
            }
            .pda-scrollbar::-webkit-scrollbar-button {
              background: #1a1a1a;
              border: 1px solid #2a2a2a;
              height: 16px;
            }
            .pda-scrollbar::-webkit-scrollbar-button:vertical:decrement {
              border-radius: 5px 5px 0 0;
            }
            .pda-scrollbar::-webkit-scrollbar-button:vertical:increment {
              border-radius: 0 0 5px 5px;
            }
            .pda-scrollbar::-webkit-scrollbar-button:hover {
              background: #2a2a2a;
            }
          `}
        </style>
      </div>
    </>
  );
}
