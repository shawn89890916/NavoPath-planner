// NavoPath Sync host runtime for Super Productivity 20.1+.
(() => {

    const API = PluginAPI;
    // Native host dialog reuses the existing plugin UI; the runtime is loaded once
    // by the host and is not tied to opening or closing that dialog.
    const surface = document.createElement('div');
    const root = surface.attachShadow({mode: 'open'});
    const style = document.createElement('style');
    style.textContent = "\n    :host { color-scheme: light dark; font: 14px/1.55 system-ui, sans-serif; }\n    * { box-sizing: border-box; }\n    :host { margin: 0; color: var(--text-color, #27231e); background: var(--bg, #f8f7f3); }\n    main { width: min(100%, 520px);  margin-inline: auto; display: grid; align-content: start; gap: 18px; padding: clamp(20px, 5vw, 30px) clamp(18px, 5vw, 26px) 28px; }\n    h1 { margin: 0; font: 650 23px/1.2 Georgia, serif; letter-spacing: -.02em; }\n    p { margin: 0; color: var(--text-color-muted, #716a60); }\n    main > p:first-of-type { max-width: 42ch; line-height: 1.65; }\n    button, input { font: inherit; color: inherit; }\n    button { min-width: 0; min-height: 42px; padding: 9px 14px; border: 1px solid var(--divider-color, #d9d1c5); border-radius: 8px; background: transparent; cursor: pointer; transition: border-color .15s ease, background-color .15s ease; }\n    button[aria-pressed=\"true\"] { color: var(--button-text, #fff); background: var(--c-primary, #584d3d); border-color: var(--c-primary, #584d3d); }\n    button:active:not(:disabled) { transform: translateY(1px); }\n    #status[aria-busy=\"true\"] { border-left-color: var(--c-primary, #584d3d); }\n    button:hover { border-color: var(--c-primary, #584d3d); }\n    button:disabled { opacity: .55; cursor: wait; }\n    button:focus-visible, input:focus-visible { outline: 2px solid var(--c-primary, #584d3d); outline-offset: 2px; }\n    #connect, #confirm { width: 100%; color: var(--button-text, #fff); border-color: var(--c-primary, #584d3d); background: var(--c-primary, #584d3d); font-weight: 650; }\n    input[type=text] { width: 100%; min-height: 44px; padding: 10px 12px; border: 1px solid var(--divider-color, #d9d1c5); border-radius: 7px; background: var(--input-bg, transparent); }\n    .row { display: flex; flex-wrap: wrap; gap: 9px; align-items: center; }\n    .card { display: grid; gap: 13px; padding: 18px; border: 1px solid var(--divider-color, #d9d1c5); border-left: 2px solid var(--c-primary, #584d3d); border-radius: 10px; background: color-mix(in srgb, var(--input-bg, #fff) 48%, transparent); }\n    [hidden] { display: none; }\n    .list { display: grid; gap: 8px; max-height: 240px; overflow: auto; }\n    label { display: flex; gap: 10px; align-items: flex-start; overflow-wrap: anywhere; line-height: 1.5; }\n    label input { flex: 0 0 auto; margin-top: 4px; accent-color: var(--c-primary, #584d3d); }\n    .conflict { display: grid; gap: 9px; padding: 13px 0; border-top: 1px solid var(--divider-color, #d9d1c5); }\n    .value { color: var(--text-color-muted, #716a60); overflow-wrap: anywhere; }\n    #status { min-height: 24px; padding: 9px 12px; border-left: 2px solid var(--divider-color, #d9d1c5); color: var(--text-color-muted, #716a60); overflow-wrap: anywhere; }\n    #status.error { border-left-color: var(--color-danger, #a13d32); color: var(--color-danger, #a13d32); }\n    @media (max-width: 360px) { main { padding-inline: 14px; } .card { padding: 14px; } .row > button { flex: 1 1 130px; } }\n  ";
    const template = document.createElement('template');
    template.innerHTML = "<main>\n    <h1>NavoPath Sync</h1>\n    <p>Pair this Super Productivity installation with NavoPath. Projects and tasks sync while both apps are online.</p>\n    <section class=\"card\" id=\"pairing\">\n      <p>Paste a pairing code from the NavoPath Super Productivity Sync plugin. Each device pairs once.</p>\n      <input id=\"code\" type=\"text\" autocomplete=\"off\" spellcheck=\"false\" aria-label=\"NavoPath pairing code\" placeholder=\"Pairing code\" />\n      <button id=\"connect\" type=\"button\">Connect</button>\n    </section>\n    <p id=\"status\" role=\"status\" aria-live=\"polite\">Not connected</p>\n    <div class=\"row\"><button id=\"sync\" type=\"button\" hidden>Sync now</button><button id=\"disconnect\" type=\"button\" hidden>Forget this device</button></div>\n    <section class=\"card\" id=\"deleted\" hidden><strong>Recently deleted (30 days)</strong><div id=\"deleted-list\" class=\"list\"></div></section>\n    <section class=\"card\" id=\"preview\" hidden>\n      <strong>First import preview</strong>\n      <p>Choose the source of shared fields. Unchecked items stay separate.</p>\n      <p id=\"preview-summary\" aria-live=\"polite\"></p>\n      <div id=\"preview-options\" class=\"row\"><button type=\"button\" id=\"all\">Select all</button><button type=\"button\" id=\"none\">Clear all</button><button type=\"button\" id=\"np-wins\">Use NavoPath for all</button><button type=\"button\" id=\"sp-wins\">Use SP for all</button></div>\n      <div id=\"project-matches\" class=\"list\"></div>\n      <div id=\"task-matches\" class=\"list\"></div>\n      <button id=\"confirm\" type=\"button\">Confirm and start syncing</button>\n    </section>\n    <section class=\"card\" id=\"conflicts\" hidden><strong>Conflicts</strong><div id=\"conflict-list\"></div></section>\n  </main>";
    root.append(style, template.content.cloneNode(true));
    let dialogOpen = false, timer, retryTimer, debounceTimer, lastSnapshot = '', ready = false;
    const dialogId = 'navopath-sync-host-' + Math.random().toString(36).slice(2);
    function openPanel() {
      if (dialogOpen || stopped) return;
      dialogOpen = true;
      let attempts = 0;
      const mount = () => {
        if (!dialogOpen || stopped) return;
        const holder = document.getElementById(dialogId);
        if (holder) holder.append(surface);
        else if (++attempts < 100) retryTimer = setTimeout(mount, 30);
      };
      Promise.resolve(API.openDialog({title:'NavoPath Sync',htmlContent:`<div id="${dialogId}"></div>`,buttons:[{label:'Close'}]}))
        .catch(error => setStatus(error?.message || String(error),true))
        .finally(() => { dialogOpen = false; clearTimeout(retryTimer); surface.remove(); });
      mount();
    }
    API.registerConfigHandler(openPanel);
    API.registerMenuEntry({label:'NavoPath Sync',icon:'sync',onClick:openPanel});
    const BASE = 'https://navopath-mcp.shawn89890916.workers.dev';
    const STORE = 'navopath-sync-state';
    const TOKEN_KEY = 'navopath-sync:token:v1';
    const $ = id => root.getElementById(id);
    let local = { pairId: '', links: { tasks: {}, projects: {} }, tombstones: {}, pendingDeletes: {}, pendingHierarchy: {} };
    let previewMode = 'merge';
    let token = null, busy = false, preview = null, stopped = false, previewKey = "", previewRevision = null, lastSuccess = "", lastApplied = 0;
    const setStatus = (text, error = false) => { $('status').textContent = text; $('status').className = error ? 'error' : ''; };
    const requiredMethods = ['request', 'persistDataSynced', 'loadSyncedData', 'getAllProjects', 'getAllTags', 'getTasks', 'addTask', 'updateTask', 'deleteTask', 'addProject', 'updateProject', 'batchUpdateForProject', 'addTag', 'getSecret', 'setSecret', 'deleteSecret'];
    const missingMethods = !API ? ['PluginAPI'] : requiredMethods.filter(method => typeof API[method] !== 'function');
    if (missingMethods.length) {
      const version = API?.cfg?.appVersion ? ` (app ${API.cfg.appVersion})` : '';
      setStatus(`Super Productivity plugin bridge is missing: ${missingMethods.join(', ')}${version}. Update or restart the app, then reopen this plugin.`, true);
      $('code').disabled = $('connect').disabled = true;
    } else {
    const request = (path, method = 'GET', body, auth = token) => API.request(`${BASE}/api/super-productivity/${path}`, {
      method, headers: { ...(auth ? { Authorization: `Bearer ${auth}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    let persisted = '';
    const persist = async () => {
      const serialized = JSON.stringify(local);
      if (serialized !== persisted) { await API.persistDataSynced(serialized, STORE); persisted = serialized; }
    };
    const readToken = async () => {
      const saved = await API.getSecret(TOKEN_KEY);
      if (saved) {
        const binding = JSON.parse(saved);
        if (binding.pairId === local.pairId) return binding.token;
        return null;
      }
      // Upgrade an existing same-origin installation if its old token is visible.
      // If the iframe used separate storage, the user pairs this device again.
      let legacy = null;
      try { legacy = localStorage.getItem(TOKEN_KEY); } catch {}
      if (!legacy || !local.pairId) return null;
      await request(`state?pairId=${encodeURIComponent(local.pairId)}`,'GET',undefined,legacy);
      await API.setSecret(TOKEN_KEY, JSON.stringify({pairId:local.pairId,token:legacy}));
      try { localStorage.removeItem(TOKEN_KEY); } catch {}
      return legacy;
    };
    const writeToken = value => API.setSecret(TOKEN_KEY, JSON.stringify({pairId:local.pairId,token:value}));
    const clearToken = async () => { await API.deleteSecret(TOKEN_KEY); try { localStorage.removeItem(TOKEN_KEY); } catch {} };
    const syncId = (kind, id) => local.links[kind][id];
    const projects = () => API.getAllProjects();
    const tasks = () => API.getTasks();
    const tagNames = async task => {
      const all = await API.getAllTags();
      return (task.tagIds || []).map(id => all.find(tag => tag.id === id)?.title).filter(Boolean);
    };
    const toLocalDate = timestamp => {
      const date = new Date(timestamp);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    };
    async function snapshot() {
      const allProjects = await projects(), allTasks = await tasks();
      return {
        overwriteVersion: 1,
        hierarchyVersion: 1,
        projects: allProjects.filter(item => item.id !== 'INBOX_PROJECT').map(item => ({ id: item.id, syncId: syncId('projects', item.id), fields: { title: item.title, notes: '', color: item.theme?.primary || null } })),
        tasks: await Promise.all(allTasks.map(async item => ({ id: item.id, syncId: syncId('tasks', item.id), parentId: item.parentId || undefined, projectId: item.projectId || undefined, fields: {
          title: item.title, notes: item.notes || '', completed: item.isDone, dueDate: item.dueDay || null,
          estimateMinutes: item.dueWithTime ? Math.max(1, Math.round((item.timeEstimate || 0) / 60000)) : Math.round((item.timeEstimate || 0) / 60000), projectTitle: item.projectId === 'INBOX_PROJECT' ? '' : allProjects.find(project => project.id === item.projectId)?.title || '',
          tags: await tagNames(item), scheduledAt: item.dueWithTime ? toLocalDate(item.dueWithTime) : null,
          scheduledMinutes: item.dueWithTime ? Math.max(1, Math.round((item.timeEstimate || 0) / 60000)) : 0,
          scheduleBlocks: [], recurrence: null,
        } }))),
      };
    }
    const mergeButton = document.createElement('button'); mergeButton.type = 'button'; mergeButton.textContent = 'Merge both';
    $('preview-options').append(mergeButton);
    $('np-wins').textContent = 'Overwrite SP from NavoPath';
    $('sp-wins').textContent = 'Overwrite NavoPath from SP';
    const authority = () => previewMode === 'overwrite-navopath' ? 'navopath' : previewMode === 'overwrite-superproductivity' ? 'superproductivity' : null;
    function updatePreviewSummary() {
      const rows = [...root.querySelectorAll('#preview input[data-kind]')];
      const checked = rows.filter(input => input.checked);
      const np = checked.filter(input => input.parentElement.querySelector('select').value === 'navopath').length;
      const source = authority();
      if (preview && source) {
        const target = source === 'navopath' ? 'superproductivity' : 'navopath';
        const count = (group, side) => preview[group][side].length - preview[group].suggestions.length;
        $('preview-summary').textContent = `${source === 'navopath' ? 'NavoPath' : 'SP'} stays unchanged. ${target === 'navopath' ? 'NavoPath' : 'SP'} adds ${count('projects',source)} projects / ${count('tasks',source)} tasks; removes ${count('projects',target)} projects / ${count('tasks',target)} tasks (recoverable; SP projects are archived).`;
      } else $('preview-summary').textContent = `Link ${checked.length} of ${rows.length} matches · NavoPath wins: ${np} · SP wins: ${checked.length - np}. Unmatched items import into the other app.`;
      for (const input of rows) { input.disabled = Boolean(source); input.parentElement.querySelector('select').disabled = Boolean(source) || !input.checked; }
      $('np-wins').disabled = $('sp-wins').disabled = !preview?.overwriteSupported;
      mergeButton.setAttribute('aria-pressed', String(previewMode === 'merge'));
      for (const [id, active] of [['all', rows.length > 0 && checked.length === rows.length], ['none', rows.length > 0 && checked.length === 0], ['np-wins', previewMode === 'overwrite-navopath'], ['sp-wins', previewMode === 'overwrite-superproductivity']]) $(id).setAttribute('aria-pressed', String(active));
    }
    function setAll(selected, side, mode = 'merge') {
      previewMode = mode;
      for (const input of root.querySelectorAll('#preview input[data-kind]')) {
        input.checked = selected;
        const select = input.parentElement.querySelector('select'); select.disabled = !selected;
        if (side) select.value = side;
      }
      updatePreviewSummary();
    }
    $('all').onclick = () => setAll(true);
    $('none').onclick = () => setAll(false);
    mergeButton.onclick = () => setAll(true);
    $('np-wins').onclick = () => { if (preview?.overwriteSupported) setAll(true, 'navopath', 'overwrite-navopath'); };
    $('sp-wins').onclick = () => { if (preview?.overwriteSupported) setAll(true, 'superproductivity', 'overwrite-superproductivity'); };
    function matchRow(kind, item, counterpart, prior) {
      const label = document.createElement('label');
      const input = document.createElement('input'); input.type = 'checkbox'; input.checked = prior?.selected ?? true; input.dataset.kind = kind; input.dataset.left = item.id; input.dataset.right = counterpart.id;
      const text = document.createElement('span'); text.textContent = `${item.fields.title || '(untitled)'} ↔ ${counterpart.fields.title || '(untitled)'}`;
      const select = document.createElement('select'); select.setAttribute('aria-label', 'Preferred source');
      for (const [value, name] of [['navopath','NavoPath'], ['superproductivity','Super Productivity']]) { const option = document.createElement('option'); option.value = value; option.textContent = name; select.append(option); }
      select.value = prior?.side || 'navopath'; select.disabled = !input.checked;
      input.onchange = () => { select.disabled = !input.checked; updatePreviewSummary(); };
      select.onchange = updatePreviewSummary;
      label.append(input, text, select); return label;
    }
    function showPreview(data) {
      preview = data.preview; previewRevision = data.revision; $('preview').hidden = !preview;
      if (!preview) return;
      if (!preview.overwriteSupported) previewMode = 'merge';
      const key = JSON.stringify(preview);
      if (key === previewKey) return;
      const prior = new Map([...root.querySelectorAll('#preview input[data-kind]')].map(input => [JSON.stringify([input.dataset.kind,input.dataset.left,input.dataset.right]), {selected: input.checked, side: input.parentElement.querySelector('select').value}]));
      previewKey = key;
      for (const [kind, source, target] of [['project', preview.projects, 'project-matches'], ['task', preview.tasks, 'task-matches']]) {
        const root = $(target); root.replaceChildren();
        const suggestedById = new Map(source.suggestions.map(item => [item.navopathId, item.superproductivityId]));
        for (const item of source.navopath) {
          const counterpart = source.superproductivity.find(entry => entry.id === suggestedById.get(item.id));
          if (counterpart) root.append(matchRow(kind, item, counterpart, prior.get(JSON.stringify([kind,item.id,counterpart.id]))));
          else { const note = document.createElement('p'); note.textContent = `${item.fields.title || '(untitled)'} · import separately`; root.append(note); }
        }
        for (const item of source.superproductivity) if (!source.suggestions.some(match => match.superproductivityId === item.id)) {
          const note = document.createElement('p'); note.textContent = `${item.fields.title || '(untitled)'} · Super Productivity only`; root.append(note);
        }
      }
      if (authority()) setAll(true, authority(), previewMode); else updatePreviewSummary();
    }
    function showConflicts(conflicts = []) {
      $('conflicts').hidden = !conflicts.length; const root = $('conflict-list'); root.replaceChildren();
      for (const item of conflicts) {
        const row = document.createElement('div'); row.className = 'conflict';
        const title = document.createElement('strong'); title.textContent = `${item.kind}: ${item.field}`;
        const a = document.createElement('span'); a.className = 'value'; a.textContent = `NavoPath: ${JSON.stringify(item.navopath)}`;
        const b = document.createElement('span'); b.className = 'value'; b.textContent = `Super Productivity: ${JSON.stringify(item.superproductivity)}`;
        const buttons = document.createElement('div'); buttons.className = 'row';
        for (const [side, label] of [['navopath', 'Use NavoPath'], ['superproductivity', 'Use Super Productivity']]) {
          const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
          button.onclick = () => { if (busy) return; button.setAttribute('aria-pressed','true'); for (const control of buttons.querySelectorAll('button')) control.disabled = true; void withBusy(async () => { try { await request('resolve', 'POST', { pairId: local.pairId, conflictId: item.id, chosen: side }); await runSync(); } finally { for (const control of buttons.querySelectorAll('button')) control.disabled = false; button.setAttribute('aria-pressed','false'); } }); }; buttons.append(button);
        }
        row.append(title, a, b, buttons); root.append(row);
      }
    }
    // Keep recovery data separate from the completed deletion list until the
    // public host API confirms the task/project is no longer active.
    const safeTask = task => Object.fromEntries(['id','title','notes','isDone','timeEstimate','dueDay','dueWithTime','projectId','parentId','tagIds'].filter(key => Object.hasOwn(task,key)).map(key => [key,task[key]]));
    const safeProject = project => ({ id: project.id, title: project.title });
    const findTask = async id => (await tasks()).find(item => item.id === id);
    const findProject = async id => (await projects()).find(item => item.id === id);
    const mappedTask = id => Object.keys(local.links.tasks).find(key => local.links.tasks[key] === id);
    const completeDelete = async (sync, entry) => {
      const item = entry.kind === 'task' ? entry.task : entry.project;
      const map = local.links[entry.kind === 'task' ? 'tasks' : 'projects'];
      delete map[item.id];
      local.tombstones[sync] = { ...entry, deletedAt: new Date().toISOString() };
      delete local.pendingDeletes[sync];
      await persist();
    };
    async function reconcileDeletes() {
      // Migrate old versions' prematurely written tombstones. A still-live
      // entity is not restorable; preserve its existing mapping and retry.
      const activeTasks = await tasks(), activeProjects = await projects();
      for (const [sync, entry] of Object.entries(local.tombstones)) {
        const item = entry.kind === 'task' ? entry.task : entry.project;
        if (!item?.id) { delete local.tombstones[sync]; continue; }
        if (entry.kind === 'task') entry.task = safeTask(item);
        else entry.project = safeProject(item);
        const active = (entry.kind === 'task' ? activeTasks : activeProjects).some(value => value.id === item.id);
        if (active && !entry.restoring && !entry.restoreId) {
          local.pendingDeletes[sync] = entry;
          local.links[entry.kind === 'task' ? 'tasks' : 'projects'][item.id] = sync;
          delete local.tombstones[sync];
        }
      }
      for (const [sync, entry] of Object.entries(local.pendingDeletes)) {
        const item = entry.kind === 'task' ? entry.task : entry.project;
        if (!(entry.kind === 'task' ? activeTasks : activeProjects).some(value => value.id === item.id)) await completeDelete(sync, entry);
      }
      await persist();
    }
    async function applyDelete(action, id) {
      const sync = action.syncId;
      if (action.kind === 'project' && id === 'INBOX_PROJECT') return;
      let entry = local.pendingDeletes[sync];
      const item = action.kind === 'task' ? await findTask(id) : await findProject(id);
      if (!item) {
        if (entry) await completeDelete(sync, entry);
        return;
      }
      if (action.kind === 'task') {
        // Re-read immediately before deleting: a failed child deletion must
        // never cause its parent to cascade-delete that still-live child.
        const children = (await tasks()).filter(task => task.parentId === id);
        if (children.length || item.subTaskIds?.length) throw new Error('Retained subtasks prevent deleting this task');
        if (!entry) entry = {kind:'task', task:safeTask(item), parentSyncId: item.parentId ? local.links.tasks[item.parentId] : undefined};
        local.pendingDeletes[sync] = entry; await persist();
        await API.deleteTask(id);
        if (await findTask(id)) throw new Error('Task deletion was not confirmed by the host');
      } else {
        const projectTasks = (await tasks()).filter(task => task.projectId === id);
        if (!entry) entry = {kind:'project', project:safeProject(item), archived:true, taskIds:projectTasks.filter(task=>!task.parentId).map(task=>task.id)};
        entry.archived = true;
        local.pendingDeletes[sync] = entry; await persist();
        for (const task of projectTasks.filter(task => !task.parentId)) {
          await API.updateTask(task.id, {projectId:'INBOX_PROJECT'});
          if ((await findTask(task.id))?.projectId !== 'INBOX_PROJECT') throw new Error('Project task move was not confirmed');
        }
        if ((await tasks()).some(task => task.projectId === id)) throw new Error('Retained tasks still belong to the project');
        // Archive via the documented project API. No deleteProject permission
        // is requested and no SP-only project notes/history are destroyed.
        await API.updateProject(id, {isArchived:true});
        if (await findProject(id)) throw new Error('Project archive was not confirmed by the host');
      }
      await completeDelete(sync, entry);
    }
    async function applyParent(taskId, parentId) {
      const task = await findTask(taskId);
      if (!task) throw new Error('Task not found for hierarchy update');
      if ((task.parentId || null) === parentId) return;
      const parent = parentId ? await findTask(parentId) : null;
      if (parentId && (!parent || parent.id === taskId || parent.parentId || (await tasks()).some(item => item.parentId === taskId))) throw new Error('SP supports only two task levels; move needs review');
      const batch = async (item, next) => {
        const result = await API.batchUpdateForProject({projectId:item.projectId || 'INBOX_PROJECT',operations:[{type:'update',taskId:item.id,updates:{parentId:next}}]});
        const updated = await findTask(item.id);
        if (!result?.success || !updated || (updated.parentId || null) !== next) throw new Error('Parent change was not confirmed by the host');
        if (next) { const target = await findTask(next); if (!target || !target.subTaskIds?.includes(item.id)) throw new Error('Parent membership was not confirmed by the host'); }
      };
      let current = task;
      if (parent && current.projectId !== parent.projectId) {
        if (current.parentId) { await batch(current,null); current = await findTask(taskId); }
        await API.updateTask(taskId,{projectId:parent.projectId || 'INBOX_PROJECT'});
        current = await findTask(taskId);
        if (!current || current.projectId !== (parent.projectId || 'INBOX_PROJECT')) throw new Error('Project move was not confirmed by the host');
      }
      await batch(current,parentId);
    }
    async function reconcileHierarchy() {
      for (const [id,entry] of Object.entries(local.pendingHierarchy)) {
        await applyParent(entry.taskId,entry.parentId);
        delete local.pendingHierarchy[id]; await persist();
      }
    }
    async function finishRestore(sync, entry) {
      let newId = entry.restoreId;
      if (!newId) {
        // An interrupted host create has no idempotency key. Never repeat it
        // blindly: the user can inspect the local task and seek recovery.
        if (entry.restoring && entry.kind === 'task') throw new Error('Interrupted restore needs manual review; no duplicate was created');
        entry.restoring = true; await persist();
        if (entry.kind === 'project') {
          if (!entry.archived) throw new Error('Legacy permanently deleted project needs manual recovery');
          newId = entry.project.id;
          if (!await findProject(newId)) await API.updateProject(newId,{isArchived:false});
          if (!await findProject(newId)) throw new Error('Project restore was not confirmed');
        } else {
          const original = entry.task;
          const parentId = entry.parentSyncId ? mappedTask(entry.parentSyncId) : original.parentId;
          if (original.parentId && (!parentId || !await findTask(parentId))) { entry.restoring = false; await persist(); throw new Error('Restore the parent task first'); }
          const {id:oldId,parentId:oldParent,dueWithTime,projectId,tagIds,...fields} = safeTask(original);
          newId = await API.addTask({...fields,...(parentId ? {parentId} : {projectId:await findProject(projectId) ? projectId : 'INBOX_PROJECT',tagIds:tagIds || []}),isIgnoreShortSyntax:true});
          // Save the returned ID before any scheduling or network operation.
        }
        entry.restoreId = newId; await persist();
      }
      if (entry.kind === 'project') {
        if (!await findProject(newId)) throw new Error('Restored project is no longer active');
        for (const taskId of entry.taskIds || []) {
          const task = await findTask(taskId);
          if (task && !task.parentId && task.projectId === 'INBOX_PROJECT') await API.updateTask(taskId,{projectId:newId});
        }
        local.links.projects[newId] = sync;
      } else {
        if (!await findTask(newId)) throw new Error('Restored task is no longer active');
        if (entry.task.dueWithTime != null) await API.updateTask(newId,{dueWithTime:entry.task.dueWithTime,dueDay:null},{isIgnoreShortSyntax:true});
        local.links.tasks[newId] = sync;
      }
      await persist();
      await request('restore','POST',{pairId:local.pairId,syncId:sync,localId:newId});
      delete local.tombstones[sync]; await persist();
    }
    function showDeleted() {
      const root = $('deleted-list'); root.replaceChildren(); const cutoff = Date.now() - 30 * 86400_000;
      for (const [id, entry] of Object.entries(local.tombstones)) {
        if (!entry.restoring && Date.parse(entry.deletedAt) < cutoff) { delete local.tombstones[id]; continue; }
        const row = document.createElement('div'); row.className = 'row'; const label = document.createElement('span'); label.textContent = entry.kind === 'project' ? entry.project.title : entry.task.title || '(untitled task)';
        const restore = document.createElement('button'); restore.type = 'button'; restore.textContent = 'Restore';
        restore.onclick = () => void withBusy(async () => {
          await finishRestore(id,entry); await runSync();
        }); row.append(label, restore); root.append(row);
      }
      $('deleted').hidden = root.childElementCount === 0;
    }
    function setAssignments(items = []) {
      for (const item of items) local.links[item.kind === 'task' ? 'tasks' : 'projects'][item.id] = item.syncId;
    }
    async function applyActions(actions = []) {
      const allProjects = await projects();
      // A parent delete can cascade. Preserve every task before its removal,
      // and refuse to remove a parent if a retained child would disappear.
      const allTasks = await tasks();
      const failures = [];
      const depth = (id) => { let n = 0, current = allTasks.find(task => task.id === id); const seen = new Set(); while (current?.parentId && !seen.has(current.id)) { seen.add(current.id); n++; current = allTasks.find(task => task.id === current.parentId); } return n; };
      const phase = action => action.deleted ? (action.kind === 'task' ? 2 : 3) : (action.kind === 'project' ? 0 : 1);
      actions = [...actions].sort((a,b) => phase(a) - phase(b) || (phase(a) === 2 ? depth(b.id) - depth(a.id) : 0));
      for (const action of actions) {
        const map = local.links[action.kind === 'task' ? 'tasks' : 'projects'];
        let id = Object.keys(map).find(key => map[key] === action.syncId) || action.id;
        if (action.kind === 'project' && id === 'INBOX_PROJECT') { delete map[id]; continue; }
        try {
        if (action.deleted) {
          await applyDelete(action,id);
          continue;
        }
        const fields = action.fields || {};
        if (action.kind === 'project') {
          const existing = allProjects.find(item => item.id === id);
          if (existing) { const patch = { title: fields.title || existing.title, theme: { ...existing.theme, primary: fields.color || existing.theme?.primary } }; await API.updateProject(existing.id, patch); allProjects[allProjects.indexOf(existing)] = { ...existing, ...patch }; }
          else { const title = fields.title || 'Imported project'; const created = await API.addProject({ title, theme: { primary: fields.color || undefined } }); map[created] = action.syncId; const createdProject = (await projects()).find(item => item.id === created); if (createdProject) allProjects.push(createdProject); }
          continue;
        }
        let current = await findTask(id);
        const hasParent = Object.hasOwn(fields,'parentSyncId');
        let parentId;
        if (hasParent) {
          parentId = fields.parentSyncId == null ? null : mappedTask(fields.parentSyncId);
          if (fields.parentSyncId != null && !parentId) throw new Error('Parent is not yet available');
          if (parentId) {
            const parent = await findTask(parentId);
            if (!parent || parent.parentId || parentId === id) throw new Error('SP supports only two task levels; move needs review');
          }
          if (current && (current.parentId || null) !== parentId) {
            if (parentId && (await tasks()).some(item => item.parentId === current.id)) throw new Error('SP supports only two task levels; move needs review');
            // Journal before a multi-step cross-project reparent. A partially
            // applied relationship is never uploaded as an intentional edit.
            local.pendingHierarchy[action.syncId] = {taskId:current.id,parentId}; await persist();
            await applyParent(current.id,parentId);
            delete local.pendingHierarchy[action.syncId]; await persist();
            current = await findTask(current.id);
          }
        }
        const updates = current ? {} : { title: 'Imported task' };
        if (Object.hasOwn(fields, 'title')) updates.title = fields.title || 'Imported task';
        if (Object.hasOwn(fields, 'notes')) updates.notes = fields.notes || '';
        if (Object.hasOwn(fields, 'completed')) updates.isDone = fields.completed === true;
        if (Object.hasOwn(fields, 'estimateMinutes')) updates.timeEstimate = Math.max(0, Number(fields.estimateMinutes || 0) * 60000);
        if (Object.hasOwn(fields, 'projectTitle')) {
          const target = fields.projectTitle ? allProjects.find(project => project.id !== 'INBOX_PROJECT' && project.title === fields.projectTitle)?.id : 'INBOX_PROJECT';
          if (target && current?.projectId !== target) updates.projectId = target;
        }
        if (Object.hasOwn(fields, 'dueDate')) updates.dueDay = fields.dueDate || null;
        if (Object.hasOwn(fields, 'scheduledAt')) {
          const value = fields.scheduledAt;
          const timestamp = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? new Date(value).getTime() : NaN;
          if (!value || Number.isFinite(timestamp)) { updates.dueWithTime = value ? timestamp : null; if (updates.dueWithTime != null) updates.dueDay = null; }
        }
        if ((updates.dueWithTime ?? (Object.hasOwn(updates,'dueWithTime') ? null : current?.dueWithTime)) != null) delete updates.dueDay;
        if (updates.dueWithTime != null) updates.dueDay = null;
        if (Object.hasOwn(fields, 'scheduledMinutes') && Number(fields.scheduledMinutes) > 0) updates.timeEstimate = Math.round(Number(fields.scheduledMinutes) * 60000);
        if (Object.hasOwn(fields, 'tags')) {
          const tagList = await API.getAllTags();
          const tagIds = [];
          for (const title of fields.tags || []) {
            let tag = tagList.find(item => item.title === title);
            if (!tag) { const createdTag = await API.addTag({ title }); tag = { id: createdTag, title }; tagList.push(tag); }
            tagIds.push(tag.id);
          }
          updates.tagIds = tagIds;
        }
        if (current) {
          if (current.parentId) { delete updates.projectId; delete updates.tagIds; } // Parent owns membership.
          await API.updateTask(current.id, updates, { isIgnoreShortSyntax: true });
        }
        else {
          const { dueWithTime, ...createFields } = updates;
          if (parentId) { delete createFields.projectId; delete createFields.tagIds; createFields.parentId = parentId; }
          const created = await API.addTask({ ...createFields, isIgnoreShortSyntax: true });
          id = created; map[created] = action.syncId;
          await persist();
          if (parentId && (await findTask(created))?.parentId !== parentId) throw new Error('Subtask creation was not confirmed');
          // addTask accepts dueDay but not dueWithTime.
          if (dueWithTime != null) await API.updateTask(created, { dueWithTime, dueDay: null }, { isIgnoreShortSyntax: true });
        }
        } catch (error) { failures.push((action.fields?.title || id || action.syncId) + ': ' + (error?.message || String(error))); }
      }
      await persist();
      if (failures.length) throw new Error(`${failures.length} sync changes need attention; other changes were applied. ${failures.slice(0, 3).join('; ')}`);
    }
    async function renderState(state) {
      if (state.pairId) local.pairId = state.pairId;
      $('pairing').hidden = Boolean(token && local.pairId); $('sync').hidden = !(token && local.pairId); $('disconnect').hidden = !(token && local.pairId);
      if (state.status === 'preview') showPreview(state); else { preview = null; previewKey = ''; $('preview').hidden = true; }
      showConflicts(state.conflicts || []);
      showDeleted();
      const labels = {waiting:'Waiting for the other app',preview:'Connected · review first import',active:'Connected · automatic sync',paused:'Paused after undo · reconnect from NavoPath'};
      setStatus(busy ? 'Syncing…' : (labels[state.status] || 'Connected'));
    }
    async function withBusy(work) {
      if (busy || stopped) return; busy = true; $('connect').disabled = $('sync').disabled = $('confirm').disabled = $('disconnect').disabled = true;
      $('status').setAttribute('aria-busy','true'); $('sync').textContent = 'Syncing…'; $('confirm').textContent = 'Working…'; setStatus('Syncing…');
      try { await work(); if (token && local.pairId) setStatus(preview ? 'Connected · review first import' : lastSuccess ? `Last sync ${lastSuccess} · ${lastApplied} changes applied` : 'Waiting for the other app'); } catch (error) { setStatus(error?.message || String(error), true); }
      finally { busy = false; $('status').setAttribute('aria-busy','false'); $('sync').textContent = 'Sync now'; $('confirm').textContent = 'Confirm and start syncing'; $('connect').disabled = $('sync').disabled = $('confirm').disabled = $('disconnect').disabled = false; }
    }
    async function runSync() {
      if (!token || !local.pairId || stopped) return;
      const state = await request(`state?pairId=${encodeURIComponent(local.pairId)}`); await renderState(state);
      if (state.status === 'paused') return;
      await reconcileDeletes();
      await reconcileHierarchy();
      for (const [id,entry] of Object.entries(local.tombstones)) if (entry.restoreId) await finishRestore(id,entry); else if (entry.restoring) throw new Error('Interrupted restore needs manual review');
      if (state.status === 'preview') {
        const outgoing = await snapshot();
        if (JSON.stringify(outgoing) !== lastSnapshot) {
          const result = await request('snapshot','POST',{pairId:local.pairId,platform:'superproductivity',snapshot:outgoing});
          lastSnapshot = JSON.stringify(outgoing); await renderState(result);
        }
        return;
      }
      const outgoing = await snapshot(); lastSnapshot = JSON.stringify(outgoing);
      const result = await request('snapshot', 'POST', { pairId: local.pairId, platform: 'superproductivity', snapshot: outgoing });
      setAssignments(result.assignments || []); await applyActions(result.actions || []); await persist(); lastSnapshot = JSON.stringify(await snapshot()); if (result.status === 'active') { lastApplied = (result.actions || []).length; lastSuccess = new Date().toLocaleTimeString(); } await renderState(result);
    }
    $('connect').onclick = () => void withBusy(async () => {
      const code = $('code').value.trim(); if (!code) throw new Error('Paste a pairing code first');
      const result = await request('exchange', 'POST', { code }, null);
      if (local.pairId && local.pairId !== result.pairId) local = {pairId:'', links:{tasks:{},projects:{}}, tombstones:{}, pendingDeletes:{},pendingHierarchy:{}};
      local.pairId = result.pairId; await writeToken(result.token); token = result.token; await persist();
      $('code').value = ''; await runSync();
    });
    $('sync').onclick = () => void withBusy(runSync);
    $('confirm').onclick = () => void withBusy(async () => {
      const matches = [...root.querySelectorAll('#preview input[type=checkbox]:checked')].map(input => ({ kind: input.dataset.kind, navopathId: input.dataset.left, superproductivityId: input.dataset.right, preferredSide: input.parentElement.querySelector('select').value }));
      const state = await request(`state?pairId=${encodeURIComponent(local.pairId)}`);
      if (state.status !== 'preview' || JSON.stringify(state.preview) !== previewKey) { await renderState(state); throw new Error('Preview changed. Review it before confirming.'); }
      const mode = previewMode, overwrite = mode !== 'merge';
      if (overwrite) {
        if (!preview?.overwriteSupported) throw new Error('Update both plugins and the cloud service first');
        const result = await API.openDialog({title:'Confirm overwrite',content:$('preview-summary').textContent,buttons:[{label:'Cancel'},{label:'Overwrite',color:'warn',raised:true}]});
        if (result !== 'Overwrite') return;
      }
      await renderState(await request('confirm', 'POST', { pairId: local.pairId, matches, mode, confirmOverwrite: overwrite, expectedRevision: state.revision })); await runSync();
    });
    $('disconnect').onclick = () => void withBusy(async () => {
      await clearToken(); token = null; lastSuccess = ''; lastSnapshot = ''; preview = null; previewKey = '';
      // Forget this device only; other devices may use the same synced task links.
      $('preview').hidden = $('conflicts').hidden = $('deleted').hidden = true;
      $('pairing').hidden = false; $('sync').hidden = $('disconnect').hidden = true; setStatus('Disconnected on this device');
    });
    async function init() {
      if (ready || stopped) return; ready = true;
      try {
        const stored = await API.loadSyncedData(STORE); if (stored) { local = { ...local, ...JSON.parse(stored) }; persisted = JSON.stringify(local); }
        token = await readToken(); $('pairing').hidden = Boolean(token && local.pairId); $('sync').hidden = !(token && local.pairId); $('disconnect').hidden = !(token && local.pairId);
        if (token && local.pairId) await withBusy(runSync); else if (local.pairId) setStatus('This device needs its own pairing code');
      } catch (error) { setStatus(error?.message || String(error), true); }
      timer = setInterval(() => { if (!busy && token && local.pairId) void withBusy(runSync); }, 15_000);
    }
    // Local task/project events accelerate the next snapshot; the periodic poll
    // also picks up remote changes and works with the UI closed.
    const queueSync = () => {
      if (!ready || stopped || busy || !token || !local.pairId) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        if (busy || stopped) return;
        try {
          const changed = JSON.stringify(await snapshot()) !== lastSnapshot;
          if (changed && !busy && !stopped) await withBusy(runSync);
        } catch (error) { setStatus(error?.message || String(error), true); }
      }, 600);
    };
    for (const hook of ['TASK_CREATED','TASK_UPDATE','TASK_DELETE','TASK_COMPLETE','PROJECT_LIST_UPDATE']) {
      if (API.Hooks?.[hook]) API.registerHook(API.Hooks[hook], queueSync);
    }
    API.onUnload?.(() => { stopped = true; clearInterval(timer); clearTimeout(debounceTimer); clearTimeout(retryTimer); surface.remove(); });
    if (API.onReady) API.onReady(init); else void init();
    }
  
})();
