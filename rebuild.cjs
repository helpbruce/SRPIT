const fs = require('fs');
const path = 'c:\\srpit\\SRPIT-main\\SRPIT-main\\src\\features\\pda\\DatabaseView.tsx';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

// Keep lines 1-624 (0-indexed: 0-623), skip 625-1500, keep 1501+ (0-indexed: 1500+)
const before = lines.slice(0, 624).join('\n');
const after = lines.slice(1500).join('\n');

const newDetail = `  // ===== DETAIL VIEW (лента сообщений) =====
  if (selectedCharacter) {
    const cur = detailEditMode && detailForm ? detailForm : selectedCharacter;

    return (
      <div className={\`flex-1 flex flex-col overflow-hidden \${bgColor}\`}>
        {/* Header */}
        <div className={\`p-3 border-b \${borderColor} flex-shrink-0 flex items-center justify-between\`}>
          <button onClick={() => { playAllSound(); setSelectedCharacter(null); setEntries([]); setDetailSection('entries'); setTaskInput({ description: '', reward: '', timeLimit: '' }); setDetailEditMode(false); setDetailForm(null); }} className={\`px-3 py-1.5 \${isSecret ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-[#2a2a2a] border-[#3a3a3a] text-gray-400'} border rounded font-mono text-xs flex items-center gap-1 hover:opacity-80 transition-all\`}>
            <ChevronLeft className="w-4 h-4" /> НАЗАД
          </button>
          <div className="flex items-center gap-1 px-3 py-1 bg-[#0f0f0f] border border-[#2a2a2a] rounded">
            <span className={\`\${isSecret ? 'text-red-500' : 'text-gray-400'} font-mono text-[10px] tracking-wide\`}>
              {currentTimestamp ? \`2009 // \${currentTimestamp.split(' ')[0]} \${currentTimestamp.split(' ')[1]}\` : '2009 // --.-- --:--'}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={deleteSelectedCharacter}
              className={\`px-3 py-1.5 bg-red-900/30 border-red-800 text-red-400 border rounded font-mono text-xs flex items-center gap-1 hover:opacity-80 transition-all\`}
            >
              <Trash2 className="w-4 h-4" /> УДАЛИТЬ
            </button>
            {detailEditMode ? (
              <>
                <button onClick={cancelDetailEdit} className={\`px-3 py-1.5 \${isSecret ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-[#2a2a2a] border-[#3a3a3a] text-gray-400'} border rounded font-mono text-xs hover:opacity-80 transition-all\`}>ОТМЕНА</button>
                <button onClick={saveDetailEdit} className={\`px-3 py-1.5 bg-green-900/30 border-green-800 text-green-400 border rounded font-mono text-xs flex items-center gap-1 hover:opacity-80 transition-all\`}><Save className="w-4 h-4" /> СОХРАНИТЬ</button>
              </>
            ) : (
              <>
                <button onClick={() => { playAllSound(); setDetailSection('tasks'); }} className={\`px-3 py-1.5 \${detailSection === 'tasks' ? 'bg-yellow-700/40 border-yellow-600 text-yellow-200' : isSecret ? 'bg-yellow-900/30 border-yellow-800 text-yellow-400' : 'bg-yellow-700/30 border-yellow-600 text-yellow-300'} border rounded font-mono text-xs flex items-center gap-1 hover:opacity-80 transition-all\`}><CheckSquare className="w-4 h-4" /> ЗАДАЧИ</button>
                <button onClick={startDetailEdit} className={\`px-3 py-1.5 \${isSecret ? 'bg-green-900/30 border-green-800 text-green-400' : 'bg-gray-700/30 border-gray-600 text-gray-300'} border rounded font-mono text-xs flex items-center gap-1 hover:opacity-80 transition-all\`}><Edit2 className="w-4 h-4" /> ИЗМЕНИТЬ</button>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pda-scrollbar">
          {/* Character Header */}
          <div className={\`p-4 border-b \${borderColor}\`}>
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <img src={cur.photo} className="w-24 h-32 object-cover rounded border border-[#2a2a2a]" alt="" />
                <div className="mt-2 flex items-center justify-center gap-1">
                  <div className={\`w-2 h-2 rounded-full \${getStatusDotColor(cur.status)} animate-pulse\`}></div>
                  <span className={\`\${textMuted} font-mono text-[10px]\`}>{cur.status}</span>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <label className={\`block \${textMuted} text-[9px] font-mono mb-0.5\`}>ИМЯ</label>
                  {detailEditMode ? (
                    <input type="text" value={cur.name} onChange={(e) => setDetailForm({...cur, name: e.target.value})} className={\`w-full p-1.5 \${inputBg} border rounded font-mono text-xs \${textColor} focus:outline-none\`} />
                  ) : (
                    <h2 className={\`\${textLight} font-mono text-lg font-bold\`}>{cur.name || 'Без имени'}</h2>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={\`block \${textMuted} text-[9px] font-mono mb-0.5\`}>ФРАКЦИЯ</label>
                    {detailEditMode ? (
                      <input type="text" value={cur.faction} onChange={(e) => setDetailForm({...cur, faction: e.target.value})} className={\`w-full p-1.5 \${inputBg} border rounded font-mono text-xs \${textColor} focus:outline-none\`} />
                    ) : (
                      <div className={\`\${textMuted} font-mono text-xs\`}>{cur.faction || '\u2014'}</div>
                    )}
                  </div>
                  <div>
                    <label className={\`block \${textMuted} text-[9px] font-mono mb-0.5\`}>РАНГ</label>
                    {detailEditMode ? (
                      <input type="text" value={cur.rank} onChange={(e) => setDetailForm({...cur, rank: e.target.value})} className={\`w-full p-1.5 \${inputBg} border rounded font-mono text-xs \${textColor} focus:outline-none\`} />
                    ) : (
                      <div className={\`\${textMuted} font-mono text-xs\`}>{cur.rank || '\u2014'}</div>
                    )}
                  </div>
                  <div>
                    <label className={\`block \${textMuted} text-[9px] font-mono mb-0.5\`}>ДАТА РОЖДЕНИЯ</label>
                    {detailEditMode ? (
                      <input type="text" value={cur.birthDate} onChange={(e) => setDetailForm({...cur, birthDate: e.target.value})} className={\`w-full p-1.5 \${inputBg} border rounded font-mono text-xs \${textColor} focus:outline-none\`} />
                    ) : (
                      <div className={\`\${textMuted} font-mono text-xs\`}>{cur.birthDate ? \`\${cur.birthDate}\` : '\u2014'}</div>
                    )}
                  </div>
                  <div>
                    <label className={\`block \${textMuted} text-[9px] font-mono mb-0.5\`}>ДЕЛО</label>
                    {detailEditMode ? (
                      <input type="text" value={cur.caseNumber} onChange={(e) => setDetailForm({...cur, caseNumber: e.target.value})} className={\`w-full p-1.5 \${inputBg} border rounded font-mono text-xs \${textColor} focus:outline-none\`} />
                    ) : (
                      <div className={\`\${textMuted} font-mono text-xs\`}>{cur.caseNumber || '\u2014'}</div>
                    )}
                  </div>
                </div>
                <div>
                  <label className={\`block \${textMuted} text-[9px] font-mono mb-0.5\`}>СТАТУС</label>
                  {detailEditMode ? (
                    <select value={cur.status} onChange={(e) => setDetailForm({...cur, status: e.target.value})} className={\`w-full p-1.5 \${inputBg} border rounded font-mono text-xs \${textColor} focus:outline-none\`}>
                      <option value="Активен">Активен</option><option value="Пропал">Пропал</option><option value="Мертв">Мертв</option><option value="В розыске">В розыске</option><option value="Неизвестен">Неизвестен</option>
                    </select>
                  ) : (
                    <div className={\`\${textMuted} font-mono text-xs\`}>{cur.status}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className={\`p-4 border-b \${borderColor}\`}>
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
                  className={\`px-3 py-1.5 border rounded font-mono text-[10px] flex items-center gap-2 \${detailSection === tab.key ? 'bg-[#2a2a2a] border-[#5c5c5c] text-gray-100' : 'bg-[#0a0a0a] border-[#2a2a2a] text-gray-400 hover:bg-[#111111]'}\`}
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
                <div className={\`\${textMuted} font-mono text-[10px] mb-2 flex items-center gap-2\`}>
                  <MessageSquare className="w-3 h-3" /> ЗАПИСИ
                </div>
                {loadingEntries ? (
                  <div className={\`\${textMuted} font-mono text-xs\`}>Загрузка записей...</div>
                ) : entries.length === 0 ? (
                  <div className={\`\${textMuted} font-mono text-xs\`}>Записей пока нет.</div>
                ) : (
                  entries.map(entry => (
                    <div key={entry.id} className="group relative">
                      <div className="absolute -top-5 left-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        <span className={\`\${isSecret ? 'text-red-700' : 'text-gray-600'} font-mono text-[9px] bg-black/80 px-2 py-1 rounded\`}>
                          [{formatEntryDate(entry.created_at)} | {entry.author_login}]
                          {entry.is_update && <span className={\`\${isSecret ? 'text-yellow-600' : 'text-yellow-500'}\`}> [UPD]</span>}
                        </span>
                      </div>
                      <div className={\`p-3 rounded-lg border \${
                        entry.entry_type === 'task'
                          ? isSecret ? 'bg-yellow-600/10 border-yellow-600/30' : 'bg-yellow-500/10 border-yellow-500/30'
                          : entry.entry_type === 'edit'
                          ? isSecret ? 'bg-blue-600/10 border-blue-600/30' : 'bg-blue-500/10 border-blue-500/30'
                          : isSecret ? 'bg-red-950/30 border-red-900/30' : 'bg-[#0a0a0a] border-[#2a2a2a]'
                      }\`}>
                        <div className={\`\${textColor} font-mono text-xs whitespace-pre-wrap break-words\`}>{entry.content}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Полная информация */}
            {detailSection === 'full_info' && (
              <div className="space-y-3">
                <div className={\`\${textMuted} font-mono text-[10px] mb-2 flex items-center justify-between\`}>
                  <div className="flex items-center gap-2"><FileText className="w-3 h-3" /> ПОЛНАЯ ИНФО</div>
                  {editingFullInfo ? (
                    <button onClick={saveFullInfo} className={\`px-2 py-0.5 bg-green-900/30 border-green-800 text-green-400 border rounded font-mono text-[10px] flex items-center gap-1\`}><Save className="w-3 h-3" /> СОХРАНИТЬ</button>
                  ) : (
                    <button onClick={() => { playAllSound(); setFullInfoText(selectedCharacter.fullInfo || ''); setEditingFullInfo(true); }} className={\`px-2 py-0.5 \${isSecret ? 'bg-green-900/30 border-green-800 text-green-400' : 'bg-gray-700/30 border-gray-600 text-gray-300'} border rounded font-mono text-[10px] flex items-center gap-1\`}><Edit2 className="w-3 h-3" /> ИЗМЕНИТЬ</button>
                  )}
                </div>
                {editingFullInfo ? (
                  <textarea
                    value={fullInfoText}
                    onChange={(e) => setFullInfoText(e.target.value)}
                    className={\`w-full p-3 \${inputBg} border rounded font-mono text-xs \${textColor} resize-none focus:outline-none\`}
                    rows={12}
                    autoFocus
                  />
                ) : (
                  <div className={\`w-full p-4 \${inputBg} border rounded font-mono text-xs \${textColor} min-h-[300px] whitespace-pre-wrap\`}>
                    {selectedCharacter.fullInfo || 'Полная информация отсутствует'}
                  </div>
                )}
              </div>
            )}

            {/* Задачи */}
            {detailSection === 'tasks' && (
              <div className="space-y-3">
                <div className={\`\${textMuted} font-mono text-[10px] mb-2 flex items-center gap-2\`}>
                  <CheckSquare className="w-3 h-3" /> ВЫДАННЫЕ ЗАДАЧИ
                </div>
                {selectedCharacter.tasks && selectedCharacter.tasks.length > 0 ? (
                  selectedCharacter.tasks.map(task => (
                    <div
                      key={task.id}
                      onDoubleClick={() => startTaskEdit(task)}
                      className={\`group relative p-3 rounded-lg border cursor-pointer transition-all \${
                        isSecret ? 'bg-red-950/20 border-red-900/30 hover:bg-red-900/30' : 'bg-[#0f0f0f] border-[#2a2a2a] hover:bg-[#1a1a1a]'
                      }\`}
                    >
                      <div className="absolute -top-5 left-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        <span className={\`\${isSecret ? 'text-red-700' : 'text-gray-600'} font-mono text-[9px] bg-black/80 px-2 py-1 rounded\`}>
                          Двойной клик — редактировать
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className={\`w-2 h-2 rounded-full \${task.status === 'в работе' ? 'bg-yellow-500' : task.status === 'провалено' ? 'bg-red-500' : 'bg-green-500'}\`}></div>
                        <span className={\`font-mono text-[10px] \${task.status === 'в работе' ? 'text-yellow-400' : task.status === 'провалено' ? 'text-red-400' : 'text-green-400'}\`}>{task.status.toUpperCase()}</span>
                      </div>
                      <div className="font-mono text-xs text-gray-200 whitespace-pre-wrap">{task.description}</div>
                      <div className="mt-1 text-[10px] font-mono text-gray-500">
                        {task.timeLimit ? \`Срок: \${task.timeLimit}\` : 'Срок не указан'}
                        {task.reward ? \` \u2022 Награда: \${task.reward}\` : ''}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={\`\${textMuted} font-mono text-xs\`}>Задач нет.</div>
                )}
              </div>
            )}

            {/* Краткая информация */}
            {detailSection === 'short_info' && (
              <div className="space-y-3">
                <div className={\`\${textMuted} font-mono text-[10px] mb-2 flex items-center justify-between\`}>
                  <div className="flex items-center gap-2"><List className="w-3 h-3" /> КРАТКАЯ ИНФО</div>
                  {editingShortInfo ? (
                    <button onClick={saveShortInfo} className={\`px-2 py-0.5 bg-green-900/30 border-green-800 text-green-400 border rounded font-mono text-[10px] flex items-center gap-1\`}><Save className="w-3 h-3" /> СОХРАНИТЬ</button>
                  ) : (
                    <button onClick={() => { playAllSound(); setShortInfoText(selectedCharacter.shortInfo || ''); setEditingShortInfo(true); }} className={\`px-2 py-0.5 \${isSecret ? 'bg-green-900/30 border-green-800 text-green-400' : 'bg-gray-700/30 border-gray-600 text-gray-300'} border rounded font-mono text-[10px] flex items-center gap-1\`}><Edit2 className="w-3 h-3" /> ИЗМЕНИТЬ</button>
                  )}
                </div>
                {editingShortInfo ? (
                  <textarea
                    value={shortInfoText}
                    onChange={(e) => setShortInfoText(e.target.value)}
                    className={\`w-full p-3 \${inputBg} border rounded font-mono text-xs \${textColor} resize-none focus:outline-none\`}
                    rows={6}
                    autoFocus
                  />
                ) : (
                  <div className={\`w-full p-4 \${inputBg} border rounded font-mono text-xs \${textColor} min-h-[180px] whitespace-pre-wrap\`}>
                    {selectedCharacter.shortInfo || 'Краткая информация отсутствует'}
                  </div>
                )}
              </div>
            )}

            {/* Заметки */}
            {detailSection === 'notes' && (
              <div className="space-y-3">
                <div className={\`\${textMuted} font-mono text-[10px] mb-2 flex items-center justify-between\`}>
                  <div className="flex items-center gap-2"><Edit3 className="w-3 h-3" /> ЗАМЕТКИ</div>
                  {editingNotes ? (
                    <button onClick={saveNotesEdit} className={\`px-2 py-0.5 bg-green-900/30 border-green-800 text-green-400 border rounded font-mono text-[10px] flex items-center gap-1\`}><Save className="w-3 h-3" /> СОХРАНИТЬ</button>
                  ) : (
                    <button onClick={() => { playAllSound(); setNotesText(selectedCharacter.notes || ''); setEditingNotes(true); }} className={\`px-2 py-0.5 \${isSecret ? 'bg-green-900/30 border-green-800 text-green-400' : 'bg-gray-700/30 border-gray-600 text-gray-300'} border rounded font-mono text-[10px] flex items-center gap-1\`}><Edit2 className="w-3 h-3" /> ИЗМЕНИТЬ</button>
                  )}
                </div>
                {editingNotes ? (
                  <textarea
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    className={\`w-full p-3 \${inputBg} border rounded font-mono text-xs \${textColor} resize-none focus:outline-none\`}
                    rows={6}
                    autoFocus
                  />
                ) : (
                  <div className={\`w-full p-4 \${inputBg} border rounded font-mono text-xs \${textColor} min-h-[180px] whitespace-pre-wrap\`}>
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
                <h3 className={\`\${textLight} font-mono text-sm font-bold\`}>РЕДАКТИРОВАНИЕ ЗАДАЧИ</h3>
                <button onClick={() => { playAllSound(); setEditingTask(null); }} className="text-gray-500 hover:text-gray-400"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto pda-scrollbar space-y-3">
                <div>
                  <label className={\`block \${textMuted} text-[10px] font-mono mb-1\`}>ЗАДАЧА</label>
                  <textarea value={editingTask.description} onChange={(e) => setEditingTask({...editingTask, description: e.target.value})} className={\`w-full p-2.5 \${inputBg} border rounded font-mono text-xs \${textColor} resize-none focus:outline-none\`} rows={3} autoFocus />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={\`block \${textMuted} text-[10px] font-mono mb-1\`}>ВРЕМЯ НА ВЫПОЛНЕНИЕ</label>
                    <input type="text" value={editingTask.timeLimit} onChange={(e) => setEditingTask({...editingTask, timeLimit: e.target.value})} className={\`w-full p-2 \${inputBg} border rounded font-mono text-xs \${textColor} focus:outline-none\`} />
                  </div>
                  <div>
                    <label className={\`block \${textMuted} text-[10px] font-mono mb-1\`}>НАГРАДА</label>
                    <input type="text" value={editingTask.reward} onChange={(e) => setEditingTask({...editingTask, reward: e.target.value})} className={\`w-full p-2 \${inputBg} border rounded font-mono text-xs \${textColor} focus:outline-none\`} />
                  </div>
                </div>
                <div>
                  <label className={\`block \${textMuted} text-[10px] font-mono mb-1\`}>СТАТУС</label>
                  <select value={editingTask.status} onChange={(e) => setEditingTask({...editingTask, status: e.target.value})} className={\`w-full p-2 \${inputBg} border rounded font-mono text-xs \${textColor} focus:outline-none\`}>
                    <option value="в работе">В работе</option>
                    <option value="выполнено">Выполнено</option>
                    <option value="провалено">Провалено</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-4 flex-shrink-0">
                <button onClick={saveTaskEdit} className={\`flex-1 px-4 py-2.5 bg-green-900/30 border-green-800 text-green-300 border rounded font-mono text-xs flex items-center justify-center gap-2\`}><Save className="w-4 h-4" /> СОХРАНИТЬ</button>
                <button onClick={() => { playAllSound(); setEditingTask(null); }} className={\`px-4 py-2.5 bg-red-900/30 border-red-800 text-red-400 border rounded font-mono text-xs\`}>ОТМЕНА</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
`;

const result = before + '\n' + newDetail + '\n' + after;
fs.writeFileSync(path, result, 'utf8');
console.log('Done. Total lines in result:', result.split('\n').length);
