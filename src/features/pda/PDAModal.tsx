import { useState, useEffect, useRef, Component, ReactNode } from 'react';
import { X, Database, BookOpen, Lock, Search, Plus, ChevronLeft, Edit2, Save, Calendar, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { supabase } from '../../shared/lib/supabaseClient';
import { CacheManager } from '../../shared/lib/cache';
import { CryptoEncryptor } from '../crypto/CryptoEncryptor';
import { debounce } from '../../shared/lib/realtimeUtils';
import { DatabaseView } from './DatabaseView';

class PDAModalErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full bg-[#1a1a1a] p-6 text-red-400 font-mono text-sm overflow-auto">
          <div className="text-red-300 text-lg font-bold mb-4">ОШИБКА PDA</div>
          <div className="text-xs text-gray-400 mb-2">{this.state.error?.message}</div>
          <div className="text-[10px] text-gray-600 bg-[#0a0a0a] p-3 rounded break-all whitespace-pre-wrap">
            {this.state.error?.stack}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 px-4 py-2 bg-red-900/30 border border-red-800 rounded text-red-400 text-xs"
          >
            ПЕРЕЗАГРУЗИТЬ
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  isMuted: boolean;
}

export function PDAModal({ isOpen, onClose, isMuted }: PDAModalProps) {
  const [pdaMode, setPdaMode] = useState<'menu' | 'database' | 'bestiary' | 'crypto'>('menu');
  // Local auth state
  const [currentLogin, setCurrentLogin] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<'user' | 'admin'>('user');
  const [canAccessAbd, setCanAccessAbd] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [newSectionName, setNewSectionName] = useState('');
  const [showNewSectionModal, setShowNewSectionModal] = useState(false);

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
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards'); // режим отображения
  const [activeDatabase, setActiveDatabase] = useState<'main' | 'secret'>('main'); // активная БД
  
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

const generateTimestamp = (nickname?: string) => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  const username = nickname || currentLogin || 'Гость';
  return `[ ${day}.${month}.2009 | ${hours}:${minutes} (UTC+3:00) | ${username} ]\n`;
};

const shortInfoTemplate = 
  "|Рост: ~\n" +
  "|Вес: ~\n" +
  "|Телосложение: ~\n" +
  "|Возраст:\n" +
  "|Особенности:\n";

const [shortInfoInsertedMap, setShortInfoInsertedMap] = useState({});


  const playAllSound = () => {
    if (isMuted) return;
    if (allSoundRef.current) {
      allSoundRef.current.currentTime = 0;
      allSoundRef.current.play().catch(() => {});
    }
  };

  const playSaveSound = () => {
    if (isMuted) return;
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

  // Local auth init on open
  useEffect(() => {
    if (!isOpen) return;
    try {
      const saved = localStorage.getItem('pda_login');
      const savedRole = localStorage.getItem('pda_user_role') as 'user' | 'admin' | null;
      const savedAbd = localStorage.getItem('pda_can_access_abd');
      if (saved) {
        setCurrentLogin(saved);
        setCurrentUserRole(savedRole || 'user');
        setCanAccessAbd(savedAbd === 'true');
        setShowAuthModal(false);
      } else {
        setCurrentLogin(null);
        setCurrentUserRole('user');
        setCanAccessAbd(false);
        setShowAuthModal(true);
      }
    } catch {
      setShowAuthModal(true);
    }
  }, [isOpen]);

  // Load data from Supabase + кеш + realtime с debounce
  useEffect(() => {
    if (!supabase) {
      const cachedChars = CacheManager.get<Character[]>('pda_characters');
      const cachedBestiary = CacheManager.get<BestiaryEntry[]>('bestiary_entries');
      if (cachedChars) setCharacters(cachedChars);
      if (cachedBestiary) setBestiaryEntries(cachedBestiary);
      return;
    }

    let isMounted = true;
    let isLoading = false;

    const loadData = async () => {
      if (isLoading) return;
      isLoading = true;
      try {
        const [charactersRes, bestiaryRes] = await Promise.all([
          supabase.from('pda_characters').select('*').order('updated_at', { ascending: true }),
          supabase.from('bestiary_entries').select('*').order('updated_at', { ascending: true }),
        ]);

        if (charactersRes.error) {
          console.error('Failed to load pda_characters from Supabase:', charactersRes.error);
        } else if (isMounted && charactersRes.data) {
          const mapped: Character[] = charactersRes.data.map((row: any) => ({
            id: row.id,
            photo: row.photo ?? '/icons/nodata.png',
            name: row.name ?? '',
            birthDate: row.birthdate ?? '',
            faction: row.faction ?? '',
            rank: row.rank ?? '',
            status: row.status ?? 'Неизвестен',
            shortInfo: row.shortinfo ?? '',
            fullInfo: row.fullinfo ?? '',
            notes: row.notes ?? '',
            tasks: (row.tasks ?? []) as Task[],
            caseNumber: row.casenumber ?? '',
          }));
          setCharacters(mapped);
          CacheManager.set('pda_characters', mapped, 10 * 60 * 1000);
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
          CacheManager.set('bestiary_entries', mapped, 10 * 60 * 1000);
        }
      } finally {
        isLoading = false;
      }
    };

    // Начальная загрузка — сначала кеш, потом Supabase
    const cachedChars = CacheManager.get<Character[]>('pda_characters');
    const cachedBestiary = CacheManager.get<BestiaryEntry[]>('bestiary_entries');
    if (cachedChars && isMounted) setCharacters(cachedChars);
    if (cachedBestiary && isMounted) setBestiaryEntries(cachedBestiary);
    loadData();

    // Realtime с debounce — 500ms
    const debouncedLoad = debounce(loadData, 500);
    const channel = supabase
      .channel('pda_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pda_characters' },
        debouncedLoad
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bestiary_entries' },
        debouncedLoad
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // Secret characters (АБД) — загрузка только если admin
  const [secretCharacters, setSecretCharacters] = useState<Character[]>([]);
  const [selectedSecretCharacter, setSelectedSecretCharacter] = useState<Character | null>(null);
  const [isEditingSecret, setIsEditingSecret] = useState(false);
  const [isCreatingSecret, setIsCreatingSecret] = useState(false);
  const [editFormSecret, setEditFormSecret] = useState<Character | null>(null);
  const [secretSearchQuery, setSecretSearchQuery] = useState('');
  const [secretTasksExpanded, setSecretTasksExpanded] = useState(false);
  const [expandedSecretShortInfo, setExpandedSecretShortInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !canAccessAbd) return;
    let isMounted = true;
    let isLoading = false;

    const loadSecret = async () => {
      if (isLoading) return;
      isLoading = true;
      try {
        const { data, error } = await supabase
          .from('secret_characters')
          .select('*')
          .order('updated_at', { ascending: true });
        if (error) { console.error('Failed to load secret_characters:', error); return; }
        if (!isMounted || !data) return;
        const mapped: Character[] = data.map((row: any) => ({
          id: row.id, photo: row.photo ?? '/icons/nodata.png', name: row.name ?? '',
          birthDate: row.birthdate ?? '', faction: row.faction ?? '', rank: row.rank ?? '',
          status: row.status ?? 'Неизвестен', shortInfo: row.shortinfo ?? '', fullInfo: row.fullinfo ?? '',
          notes: row.notes ?? '', tasks: (row.tasks ?? []) as Task[], caseNumber: row.casenumber ?? '',
        }));
        setSecretCharacters(mapped);
        CacheManager.set('secret_characters', mapped, 10 * 60 * 1000);
      } finally { isLoading = false; }
    };

    const cached = CacheManager.get<Character[]>('secret_characters');
    if (cached && isMounted) setSecretCharacters(cached);
    loadSecret();

    const debouncedLoad = debounce(loadSecret, 500);
    const channel = supabase
      .channel('secret_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'secret_characters' },
        () => { if (isMounted) debouncedLoad(); })
      .subscribe();

    return () => { isMounted = false; supabase.removeChannel(channel); };
  }, [canAccessAbd]);


  const filteredCharacters = characters.filter(char => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    // Если ищут "задача" — показать только персонажей с активными задачами
    if (query === 'задача' || query === 'задач') {
      return char.tasks.some(t => t.status === 'в работе');
    }
    return (
      char.name.toLowerCase().includes(query) ||
      char.faction.toLowerCase().includes(query) ||
      char.rank.toLowerCase().includes(query) ||
      char.status.toLowerCase().includes(query) ||
      char.shortInfo.toLowerCase().includes(query) ||
      char.fullInfo.toLowerCase().includes(query) ||
      char.caseNumber.toLowerCase().includes(query) ||
      char.tasks.some(t => t.description.toLowerCase().includes(query))
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
        photo: editForm.photo || null,
        name: editForm.name || '',
        birthdate: editForm.birthDate || null,
        faction: editForm.faction || null,
        rank: editForm.rank || null,
        status: editForm.status || 'Неизвестен',
        shortinfo: editForm.shortInfo || null,
        fullinfo: editForm.fullInfo || null,
        notes: editForm.notes || null,
        casenumber: editForm.caseNumber || null,
        tasks: editForm.tasks || null,
        author_login: currentLogin || null,
        updated_at: new Date().toISOString(),
      };

      // Обновляем кеш
      const updated = isCreating 
        ? [...characters, editForm]
        : characters.map(c => c.id === editForm.id ? editForm : c);
      CacheManager.set('pda_characters', updated, 10 * 60 * 1000);

      supabase
        .from('pda_characters')
        .upsert(payload, { onConflict: 'id' })
        .then(({ error }) => {
          if (error) {
            console.error('Failed to upsert pda_character in Supabase:', error);
            alert('Ошибка сохранения: ' + error.message);
            // Откатываем кеш при ошибке
            CacheManager.set('pda_characters', characters, 10 * 60 * 1000);
          } else {
            console.log('Character saved successfully');
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
      const updated = characters.filter(c => c.id !== id);
      setCharacters(updated);
      CacheManager.set('pda_characters', updated, 10 * 60 * 1000);
      
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
              // Откатываем при ошибке
              setCharacters(characters);
              CacheManager.set('pda_characters', characters, 10 * 60 * 1000);
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
      status: 'в работе',
      reward: '',
      timeLimit: ''
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
    const updated = existing
      ? bestiaryEntries.map(e => e.id === bestiaryEditForm.id ? bestiaryEditForm : e)
      : [...bestiaryEntries, bestiaryEditForm];
    
    setBestiaryEntries(updated);
    setSelectedEntry(bestiaryEditForm);
    CacheManager.set('bestiary_entries', updated, 10 * 60 * 1000);

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
        author_login: currentLogin || null,
      };

      supabase
        .from('bestiary_entries')
        .upsert(payload, { onConflict: 'id' })
        .then(({ error }) => {
          if (error) {
            console.error('Failed to upsert bestiary_entry in Supabase:', error);
            // Откатываем при ошибке
            setBestiaryEntries(bestiaryEntries);
            CacheManager.set('bestiary_entries', bestiaryEntries, 10 * 60 * 1000);
          }
        });
    }

    setIsEditingBestiary(false);
    setBestiaryEditForm(null);
  };

  const deleteBestiaryEntry = (id: string) => {
    playAllSound();
    if (confirm('Удалить запись?')) {
      const updated = bestiaryEntries.filter(e => e.id !== id);
      setBestiaryEntries(updated);
      CacheManager.set('bestiary_entries', updated, 10 * 60 * 1000);
      
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
              // Откатываем при ошибке
              setBestiaryEntries(bestiaryEntries);
              CacheManager.set('bestiary_entries', bestiaryEntries, 10 * 60 * 1000);
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

  // Local auth actions
  const handleLogin = async () => {
    if (!authEmail || !authPassword) {
      alert('Введите логин и пароль');
      return;
    }
    // Пытаемся забрать can_access_abd, но если колонки нет — фоллбэк
    let hasAbd = false;
    try {
      const { data, error } = await supabase
        .from('users_local')
        .select('password_hash, can_access_abd')
        .eq('login', authEmail)
        .maybeSingle();
      if (error) throw error;
      if (!data || data.password_hash !== authPassword) {
        alert('Неверный логин или пароль');
        return;
      }
      hasAbd = data.can_access_abd === true;
      const userRole: 'admin' | 'user' = authEmail === 'admin' ? 'admin' : 'user';
      try {
        localStorage.setItem('pda_login', authEmail);
        localStorage.setItem('pda_user_role', userRole);
        localStorage.setItem('pda_can_access_abd', String(hasAbd));
      } catch {}
      setCurrentLogin(authEmail);
      setCurrentUserRole(userRole);
      setCanAccessAbd(hasAbd);
      setShowAuthModal(false);
    } catch (e: any) {
      // Колонки can_access_abd нет — фоллбэк: просто пароль
      if (e?.message?.includes('can_access_abd') || e?.message?.includes('column') || e?.message?.includes('does not exist')) {
        const { data, error } = await supabase
          .from('users_local')
          .select('password_hash')
          .eq('login', authEmail)
          .maybeSingle();
        if (error) { alert('Ошибка входа: ' + error.message); return; }
        if (!data || data.password_hash !== authPassword) { alert('Неверный логин или пароль'); return; }
        const userRole: 'admin' | 'user' = authEmail === 'admin' ? 'admin' : 'user';
        hasAbd = authEmail === 'admin'; // admin по умолчанию имеет доступ
        try {
          localStorage.setItem('pda_login', authEmail);
          localStorage.setItem('pda_user_role', userRole);
          localStorage.setItem('pda_can_access_abd', String(hasAbd));
        } catch {}
        setCurrentLogin(authEmail);
        setCurrentUserRole(userRole);
        setCanAccessAbd(hasAbd);
        setShowAuthModal(false);
      } else {
        alert('Ошибка входа: ' + (e?.message || 'Неизвестная ошибка'));
      }
    }
  };

  const handleRegister = async () => {
    if (!authEmail || !authPassword) {
      alert('Введите логин и пароль');
      return;
    }
    const { data: exists, error: selErr } = await supabase
      .from('users_local')
      .select('id')
      .eq('login', authEmail)
      .maybeSingle();
    if (selErr) {
      alert('Ошибка проверки логина: ' + selErr.message);
      return;
    }
    if (exists) {
      alert('Логин уже занят');
      return;
    }
    const { error: insErr } = await supabase
      .from('users_local')
      .insert({ login: authEmail, password_hash: authPassword });
    if (insErr) {
      alert('Ошибка регистрации: ' + insErr.message);
      return;
    }
    const userRole: 'admin' | 'user' = authEmail === 'admin' ? 'admin' : 'user';
    try { 
      localStorage.setItem('pda_login', authEmail);
      localStorage.setItem('pda_user_role', userRole);
    } catch {}
    setCurrentLogin(authEmail);
    setCurrentUserRole(userRole);
    setShowAuthModal(false);
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('pda_login');
      localStorage.removeItem('pda_user_role');
      localStorage.removeItem('pda_can_access_abd');
    } catch {}
    setCurrentLogin(null);
    setCurrentUserRole('user');
    setCanAccessAbd(false);
    setShowAuthModal(true);
  };

  if (!isOpen) return null;
  if (showAuthModal) {
    return (
      <>
        <div className="fixed inset-0 z-[100020] flex items-center justify-center pointer-events-auto">
          <div className="w-[min(90vw,420px)] bg-[#1a1a1a] border-2 border-[#3a3a3a] rounded p-4">
            <div className="text-gray-300 font-mono text-sm mb-3">
            {authMode === 'login' ? 'ВХОД В PDA' : 'РЕГИСТРАЦИЯ В PDA'}
            </div>
            <div className="space-y-2">
            <input
            type="text"
            placeholder="Логин"
            value={authEmail}
            onChange={(e) => setAuthEmail(e.target.value)}
            className="w-full p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-gray-300 font-mono text-xs focus:border-[#3a3a3a] focus:outline-none placeholder:text-gray-700"
            />
            <input
            type="password"
            placeholder="Пароль"
            value={authPassword}
            onChange={(e) => setAuthPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                playAllSound();
                authMode === 'login' ? handleLogin() : handleRegister();
              }
            }}
            className="w-full p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-gray-300 font-mono text-xs focus:border-[#3a3a3a] focus:outline-none placeholder:text-gray-700"
            />
            
            </div>
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => { playAllSound(); authMode === 'login' ? handleLogin() : handleRegister(); }}
                className="px-3 py-1.5 bg-gray-700/30 border border-gray-600 rounded hover:bg-gray-700/50 transition-all text-gray-300 font-mono text-xs"
              >
                {authMode === 'login' ? 'ВОЙТИ' : 'ЗАРЕГИСТРИРОВАТЬСЯ'}
              </button>
              <button
                onClick={() => { playAllSound(); setAuthMode(authMode === 'login' ? 'register' : 'login'); }}
                className="px-3 py-1.5 bg-[#2a2a2a] border border-[#3a3a3a] rounded hover:bg-[#3a3a3a] transition-all text-gray-400 font-mono text-xs"
              >
                {authMode === 'login' ? 'НЕТ АККАУНТА?' : 'УЖЕ ЕСТЬ АККАУНТ?'}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <PDAModalErrorBoundary>
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
                {pdaMode === 'menu' ? 'ГЛАВНОЕ МЕНЮ' : pdaMode === 'database' ? 'БАЗА ДАННЫХ' : pdaMode === 'bestiary' ? 'БЕСТИАРИЙ' : 'ШИФРАТОР'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {pdaMode === 'menu' && (
                <button
                  className="px-2 py-1 bg-[#2a2a2a] border border-[#3a3a3a] rounded hover:bg-[#3a3a3a] transition-all text-gray-400 font-mono text-[10px] flex items-center gap-1"
                  onClick={() => { playAllSound(); setPdaMode('crypto'); }}
                >
                  <Lock className="w-3 h-3" />
                  ШИФРАТОР
                </button>
              )}
              <div className="text-gray-400 text-[10px] font-mono px-2 py-1 rounded border border-[#3a3a3a] bg-[#0f0f0f]">
                Вы: {currentLogin ?? 'Гость'} {currentUserRole === 'admin' && <span className="text-red-400 ml-1">[ADMIN]</span>}
              </div>
              {currentLogin ? (
                <button
                  className="px-2 py-1 bg-[#2a2a2a] border border-[#3a3a3a] rounded hover:bg-[#3a3a3a] transition-all text-gray-400 font-mono text-[10px]"
                  onClick={() => { playAllSound(); handleLogout(); }}
                >
                  ВЫЙТИ
                </button>
              ) : (
                <button
                  className="px-2 py-1 bg-[#2a2a2a] border border-[#3a3a3a] rounded hover:bg-[#3a3a3a] transition-all text-gray-400 font-mono text-[10px]"
                  onClick={() => { playAllSound(); setShowAuthModal(true); }}
                >
                  ВОЙТИ
                </button>
              )}
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

          {/* Crypto Mode */}
          {pdaMode === 'crypto' && (
            <CryptoEncryptor
              onBack={() => { playAllSound(); setPdaMode('menu'); }}
              isMuted={isMuted}
            />
          )}

          {/* Database Mode */}
          {pdaMode === 'database' && (
            <DatabaseView
              activeDatabase={activeDatabase}
              setActiveDatabase={setActiveDatabase}
              viewMode={viewMode}
              setViewMode={setViewMode}
              characters={activeDatabase === 'main' ? characters : secretCharacters}
              setCharacters={activeDatabase === 'main' ? setCharacters : setSecretCharacters}
              searchQuery={activeDatabase === 'main' ? searchQuery : secretSearchQuery}
              setSearchQuery={activeDatabase === 'main' ? setSearchQuery : setSecretSearchQuery}
              filteredCharacters={activeDatabase === 'main'
                ? filteredCharacters
                : secretCharacters.filter(c => !secretSearchQuery || c.name.toLowerCase().includes(secretSearchQuery.toLowerCase()) || c.faction.toLowerCase().includes(secretSearchQuery.toLowerCase()) || c.caseNumber.toLowerCase().includes(secretSearchQuery.toLowerCase()))
              }
              selectedCharacter={activeDatabase === 'main' ? selectedCharacter : selectedSecretCharacter}
              setSelectedCharacter={activeDatabase === 'main' ? setSelectedCharacter : setSelectedSecretCharacter}
              isEditing={activeDatabase === 'main' ? isEditing : isEditingSecret}
              setIsEditing={activeDatabase === 'main' ? setIsEditing : setIsEditingSecret}
              isCreating={activeDatabase === 'main' ? isCreating : isCreatingSecret}
              setIsCreating={activeDatabase === 'main' ? setIsCreating : setIsCreatingSecret}
              editForm={activeDatabase === 'main' ? editForm : editFormSecret}
              setEditForm={activeDatabase === 'main' ? setEditForm : setEditFormSecret}
              tasksExpanded={activeDatabase === 'main' ? tasksExpanded : false}
              setTasksExpanded={activeDatabase === 'main' ? setTasksExpanded : setSecretTasksExpanded}
              expandedShortInfo={activeDatabase === 'main' ? expandedShortInfo : expandedSecretShortInfo}
              setExpandedShortInfo={activeDatabase === 'main' ? setExpandedShortInfo : setExpandedSecretShortInfo}
              playAllSound={playAllSound}
              playSaveSound={playSaveSound}
              currentLogin={currentLogin}
              supabase={supabase}
              isSecret={activeDatabase === 'secret'}
              canAccessAbd={canAccessAbd}
              photo1InputRef={photo1InputRef}
              getTaskPlaceholder={getTaskPlaceholder}
              addTask={addTask}
              updateTask={updateTask}
              deleteTask={deleteTask}
            />
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
    </PDAModalErrorBoundary>
  );
}
