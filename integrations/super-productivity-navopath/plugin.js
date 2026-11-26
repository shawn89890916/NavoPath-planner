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
    let local = { pairId: '', links: { tasks: {}, projects: {} }, tombstones: {} };
    let previewMode = 'merge';
    let token = null, busy = false, preview = null, stopped = false, previewKey = "", previewRevision = null, lastSuccess = "", lastApplied = 0;
    const setStatus = (text, error = false) => { $('status').textContent = text; $('status').className = error ? 'error' : ''; };
    const requiredMethods = ['request', 'persistDataSynced', 'loadSyncedData', 'getAllProjects', 'getAllTags', 'getTasks', 'addTask', 'updateTask', 'deleteTask', 'addProject', 'updateProject', 'deleteProject', 'addTag', 'getSecret', 'setSecret', 'deleteSecret'];
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
        projects: allProjects.map(item => ({ id: item.id, syncId: syncId('projects', item.id), fields: { title: item.title, notes: '', color: item.theme?.primary || null } })),
        tasks: await Promise.all(allTasks.map(async item => ({ id: item.id, syncId: syncId('tasks', item.id), parentId: item.parentId || undefined, fields: {
          title: item.title, notes: item.notes || '', completed: item.isDone, dueDate: item.dueDay || null,
          estimateMinutes: Math.round((item.timeEstimate || 0) / 60000), projectTitle: allProjects.find(project => project.id === item.projectId)?.title || '',
          tags: await tagNames(item), scheduledAt: item.dueWithTime ? toLocalDate(item.dueWithTime) : null,
          scheduledMinutes: item.dueWithTime ? Math.round((item.timeEstimate || 0) / 60000) : 0,
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
        $('preview-summary').textContent = `${source === 'navopath' ? 'NavoPath' : 'SP'} stays unchanged. ${target === 'navopath' ? 'NavoPath' : 'SP'} adds ${count('projects',source)} projects / ${count('tasks',source)} tasks; removes ${count('projects',target)} projects / ${count('tasks',target)} tasks (Recently deleted).`;
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
    function showDeleted() {
      const root = $('deleted-list'); root.replaceChildren(); const cutoff = Date.now() - 30 * 86400_000;
      for (const [id, entry] of Object.entries(local.tombstones)) {
        if (Date.parse(entry.deletedAt) < cutoff) { delete local.tombstones[id]; continue; }
        const row = document.createElement('div'); row.className = 'row'; const label = document.createElement('span'); label.textContent = entry.kind === 'project' ? entry.project.title : entry.task.title || '(untitled task)';
        const restore = document.createElement('button'); restore.type = 'button'; restore.textContent = 'Restore';
        restore.onclick = () => void withBusy(async () => {
          let newId;
          if (entry.kind === 'project') { const project = { ...entry.project }; delete project.id; newId = await API.addProject(project); local.links.projects[newId] = id; const currentTasks = await tasks(); for (const taskId of entry.taskIds || []) if (currentTasks.some(task => task.id === taskId)) await API.updateTask(taskId, { projectId: newId }); }
          else { const task = { ...entry.task }; delete task.id; newId = await API.addTask({ ...task, isIgnoreShortSyntax: true }); local.links.tasks[newId] = id; }
          delete local.tombstones[id];
          await request('restore', 'POST', { pairId: local.pairId, syncId: id, localId: newId }); await persist(); await runSync();
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
      const deleting = new Set(actions.filter(action => action.deleted && action.kind === 'task').map(action => action.id || Object.keys(local.links.tasks).find(key => local.links.tasks[key] === action.syncId)));
      if (allTasks.some(task => task.parentId && deleting.has(task.parentId) && !deleting.has(task.id))) throw new Error('A retained subtask belongs to a task marked for deletion. Move the subtask first.');
      const depth = (id) => { let n = 0, current = allTasks.find(task => task.id === id); const seen = new Set(); while (current?.parentId && !seen.has(current.id)) { seen.add(current.id); n++; current = allTasks.find(task => task.id === current.parentId); } return n; };
      const phase = action => action.deleted ? (action.kind === 'task' ? 2 : 3) : (action.kind === 'project' ? 0 : 1);
      actions = [...actions].sort((a,b) => phase(a) - phase(b) || (phase(a) === 2 ? depth(b.id) - depth(a.id) : 0));
      for (const action of actions) {
        const map = local.links[action.kind === 'task' ? 'tasks' : 'projects'];
        let id = action.id || Object.keys(map).find(key => map[key] === action.syncId);
        if (action.deleted) {
          if (action.kind === 'task') {
            const task = (await tasks()).find(item => item.id === id);
            if (task) { local.tombstones[action.syncId] = { kind: 'task', task, deletedAt: new Date().toISOString() }; await persist(); await API.deleteTask(task.id); }
          } else {
            const project = allProjects.find(item => item.id === id);
            if (project) {
              const projectTasks = (await tasks()).filter(task => task.projectId === project.id);
              local.tombstones[action.syncId] = { kind: 'project', project, taskIds: projectTasks.map(task => task.id), deletedAt: new Date().toISOString() };
              await persist();
              for (const task of projectTasks.filter(task => !task.parentId)) await API.updateTask(task.id, { projectId: null });
              await API.deleteProject(project.id);
            }
          }
          if (id) delete map[id];
          continue;
        }
        const fields = action.fields || {};
        if (action.kind === 'project') {
          const existing = allProjects.find(item => item.id === id);
          if (existing) await API.updateProject(existing.id, { title: fields.title || existing.title, theme: { ...existing.theme, primary: fields.color || existing.theme?.primary } });
          else { const title = fields.title || 'Imported project'; const created = await API.addProject({ title, theme: { primary: fields.color || undefined } }); map[created] = action.syncId; const createdProject = (await projects()).find(item => item.id === created); if (createdProject) allProjects.push(createdProject); }
          continue;
        }
        const current = (await tasks()).find(item => item.id === id);
        const updates = current ? {} : { title: 'Imported task' };
        if (Object.hasOwn(fields, 'title')) updates.title = fields.title || 'Imported task';
        if (Object.hasOwn(fields, 'notes')) updates.notes = fields.notes || '';
        if (Object.hasOwn(fields, 'completed')) updates.isDone = fields.completed === true;
        if (Object.hasOwn(fields, 'estimateMinutes')) updates.timeEstimate = Math.max(0, Number(fields.estimateMinutes || 0) * 60000);
        if (Object.hasOwn(fields, 'projectTitle')) updates.projectId = allProjects.find(project => project.title === fields.projectTitle)?.id || null;
        if (Object.hasOwn(fields, 'dueDate')) updates.dueDay = fields.dueDate || null;
        if (Object.hasOwn(fields, 'scheduledAt')) updates.dueWithTime = fields.scheduledAt ? new Date(fields.scheduledAt).getTime() : null;
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
        if (current) await API.updateTask(current.id, updates, { isIgnoreShortSyntax: true });
        else {
          const { dueWithTime, ...createFields } = updates;
          const created = await API.addTask({ ...createFields, isIgnoreShortSyntax: true });
          id = created; map[created] = action.syncId;
          await persist();
          // addTask accepts dueDay but not dueWithTime.
          if (dueWithTime != null) await API.updateTask(created, { dueWithTime });
        }
      }
      await persist();
    }
    async function renderState(state) {
      if (state.pairId) local.pairId = state.pairId;
      $('pairing').hidden = Boolean(token && local.pairId); $('sync').hidden = !(token && local.pairId); $('disconnect').hidden = !(token && local.pairId);
      if (state.status === 'preview') showPreview(state); else { preview = null; previewKey = ''; $('preview').hidden = true; }
      showConflicts(state.conflicts || []);
      showDeleted();
      const labels = {waiting:'Waiting for the other app',preview:'Connected · review first import',active:'Connected · automatic sync'};
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
      if (local.pairId && local.pairId !== result.pairId) local = {pairId:'', links:{tasks:{},projects:{}}, tombstones:{}};
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
