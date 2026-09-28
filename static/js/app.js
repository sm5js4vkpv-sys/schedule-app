// ============================================================
//  Электронная доска расписания — app.js
// ============================================================

const state = {
    groups: [],
    teachers: [],
    subjects: [],
    classrooms: [],
    lessons: [],
    currentWeek: 0,
    drag: null,
    loaded: false
};

const DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const PAIRS = [1, 2, 3, 4, 5, 6];

function $(sel) { return document.querySelector(sel); }

function toast(msg, type = '') {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast show ' + type;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.className = 'toast hidden'; }, 3000);
}

async function api(url, options = {}) {
    const res = await fetch(url, options);
    if (res.status === 204) return { ok: true, status: 204, data: null };
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
}

async function loadAll() {
    try {
        const [g, t, s, c, l] = await Promise.all([
            api('/api/groups'),
            api('/api/teachers'),
            api('/api/subjects'),
            api('/api/classrooms'),
            api('/api/schedule')
        ]);
        state.groups = g.data || [];
        state.teachers = t.data || [];
        state.subjects = s.data || [];
        state.classrooms = c.data || [];
        state.lessons = l.data || [];
        state.loaded = true;
        renderBoard();
        renderTeachersPanel();
        renderLegend();
        console.log('✅ Данные загружены:', state);
    } catch (e) {
        console.error('Ошибка загрузки:', e);
        toast('Ошибка загрузки данных', 'error');
    }
}

function renderBoard() {
    const board = $('#board');
    if (!board) return;
    board.innerHTML = '';

    const table = document.createElement('table');
    table.className = 'schedule';

    const thead = document.createElement('thead');
    const htr = document.createElement('tr');
    htr.innerHTML = '<th>День</th><th>Пара</th>';
    state.groups.forEach(g => {
        const th = document.createElement('th');
        th.textContent = g.name;
        htr.appendChild(th);
    });
    thead.appendChild(htr);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    DAYS.forEach(day => {
        PAIRS.forEach((pair, pairIdx) => {
            const tr = document.createElement('tr');

            if (pairIdx === 0) {
                const dayTd = document.createElement('td');
                dayTd.className = 'day-cell';
                dayTd.rowSpan = PAIRS.length;
                dayTd.textContent = day;
                tr.appendChild(dayTd);
            }

            const pairTd = document.createElement('td');
            pairTd.className = 'pair-cell';
            pairTd.textContent = `${pair} пара`;
            tr.appendChild(pairTd);

            state.groups.forEach(g => {
                const td = document.createElement('td');
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.day = day;
                cell.dataset.pair = pair;
                cell.dataset.group = g.id;
                setupDropZone(cell);

                lessonsInCell(g.id, day, pair).forEach(l => {
                    cell.appendChild(buildCard(l));
                });

                td.appendChild(cell);
                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        });
    });
    table.appendChild(tbody);
    board.appendChild(table);
}

function lessonsInCell(groupId, day, pair) {
    return state.lessons.filter(l => {
        if (l.group_id !== groupId || l.day !== day) return false;
        const w1 = l.week1_lesson === pair;
        const w2 = l.week2_lesson === pair;
        if (state.currentWeek === 1) return w1;
        if (state.currentWeek === 2) return w2;
        return w1 || w2;
    });
}

function buildCard(l) {
    const div = document.createElement('div');
    div.className = 'card';
    div.style.borderLeftColor = l.teacher_color || '#3b82f6';
    div.draggable = true;
    div.dataset.id = l.id;

    let weekInfo = '';
    const w1 = l.week1_lesson ? `${l.week1_lesson} пара` : '—';
    const w2 = l.week2_lesson ? `${l.week2_lesson} пара` : '—';

    if (state.currentWeek === 0) {
        weekInfo = `<b>1 нед.:</b> ${w1}<br><b>2 нед.:</b> ${w2}`;
    } else if (state.currentWeek === 1) {
        weekInfo = `<b>1 неделя</b> → ${w1}`;
    } else {
        weekInfo = `<b>2 неделя</b> → ${w2}`;
    }

    div.innerHTML = `
        <div class="teacher">${l.teacher_name || ''}</div>
        <div class="subject">${l.subject_name || ''}</div>
        <div class="week-info">${weekInfo}</div>
        ${l.classroom_name ? `<div class="room">каб. ${l.classroom_name}</div>` : ''}
    `;

    div.addEventListener('dragstart', e => {
        state.drag = { type: 'move', lessonId: l.id };
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(l.id));
    });
    div.addEventListener('dragend', () => {
        document.querySelectorAll('.cell.drag-over')
            .forEach(c => c.classList.remove('drag-over'));
    });
    div.addEventListener('click', () => openEditModal(l));
    return div;
}

function setupDropZone(cell) {
    cell.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        cell.classList.add('drag-over');
    });
    cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));

    cell.addEventListener('drop', async e => {
        e.preventDefault();
        cell.classList.remove('drag-over');

        const day = cell.dataset.day;
        const pair = parseInt(cell.dataset.pair);
        const groupId = parseInt(cell.dataset.group);

        if (!state.drag) return;

        if (state.drag.type === 'create') {
            const { teacherId, subjectId } = state.drag;
            const weekField = state.currentWeek === 2 ? 'week2_lesson' : 'week1_lesson';
            const body = {
                group_id: groupId,
                teacher_id: teacherId,
                subject_id: subjectId,
                day: day,
                week1_lesson: weekField === 'week1_lesson' ? pair : null,
                week2_lesson: weekField === 'week2_lesson' ? pair : null,
                classroom_id: null,
                lesson_type: 'Лекция'
            };
            const res = await api('/api/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                const c = res.data.conflicts || [res.data.error || 'Ошибка'];
                toast('⚠ ' + c.join('; '), 'error');
            } else {
                toast('Занятие добавлено', 'success');
            }
        }

        if (state.drag.type === 'move') {
            const lesson = state.lessons.find(x => x.id === state.drag.lessonId);
            if (!lesson) return;
            const body = {
                group_id: groupId,
                day: day,
                week1_lesson: lesson.week1_lesson,
                week2_lesson: lesson.week2_lesson
            };
            if (state.currentWeek === 1) body.week1_lesson = pair;
            else if (state.currentWeek === 2) body.week2_lesson = pair;
            else body.week1_lesson = pair;

            const res = await api(`/api/schedule/${lesson.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                const c = res.data.conflicts || [res.data.error || 'Ошибка'];
                toast('⚠ ' + c.join('; '), 'error');
            } else {
                toast('Занятие перемещено', 'success');
            }
        }

        state.drag = null;
        await loadAll();
    });
}

function renderTeachersPanel() {
    const panel = $('#teachers-panel');
    if (!panel) return;
    panel.innerHTML = '';

    if (state.teachers.length === 0) {
        panel.innerHTML = '<p style="color:#94a3b8;font-size:12.5px">Нет преподавателей</p>';
        return;
    }

    state.teachers.forEach(t => {
        const item = document.createElement('div');
        item.className = 'teacher-item';

        const header = document.createElement('div');
        header.className = 'teacher-header';
        header.style.background = t.color || '#3b82f6';
        header.innerHTML = `
            <span>${t.name}${t.short_name ? ' <span class="teacher-short">' + t.short_name + '</span>' : ''}</span>
            <span class="arrow">▼</span>
        `;

        const list = document.createElement('div');
        list.className = 'subjects-list';

        (t.subjects || []).forEach(s => {
            const sc = document.createElement('div');
            sc.className = 'subject-card';
            sc.textContent = s.name;
            sc.draggable = true;
            sc.addEventListener('dragstart', e => {
                state.drag = { type: 'create', teacherId: t.id, subjectId: s.id };
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('text/plain', 'new');
            });
            list.appendChild(sc);
        });

        if ((t.subjects || []).length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'color:#94a3b8;font-size:12px;padding:6px';
            empty.textContent = 'Нет дисциплин';
            list.appendChild(empty);
        }

        header.addEventListener('click', () => {
            list.classList.toggle('open');
            header.classList.toggle('open');
        });

        item.appendChild(header);
        item.appendChild(list);
        panel.appendChild(item);
    });
}

function renderLegend() {
    const legend = $('#legend');
    if (!legend) return;
    legend.innerHTML = '';
    state.teachers.forEach(t => {
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `
            <span class="legend-dot" style="background:${t.color}"></span>
            <span>${t.short_name || t.name}</span>
        `;
        legend.appendChild(item);
    });
}

function fillSelect(sel, items, valueField, textField, selected) {
    if (!sel) return;
    sel.innerHTML = '';
    items.forEach(it => {
        const opt = document.createElement('option');
        opt.value = it[valueField];
        opt.textContent = it[textField];
        if (it[valueField] === selected) opt.selected = true;
        sel.appendChild(opt);
    });
}

function updateSubjectsForTeacher(teacherId, selectedSubjectId = null) {
    const t = state.teachers.find(x => x.id === teacherId);
    const sel = $('#f-subject');
    if (!sel) return;
    sel.innerHTML = '';
    ((t && t.subjects) || []).forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name;
        if (s.id === selectedSubjectId) opt.selected = true;
        sel.appendChild(opt);
    });
}

function openAddModal() {
    if (!state.loaded) return;
    $('#modal-title').textContent = 'Добавление занятия';
    $('#lesson-id').value = '';
    fillSelect($('#f-group'), state.groups, 'id', 'name');
    fillSelect($('#f-teacher'), state.teachers, 'id', 'name');
    fillSelect($('#f-classroom'), state.classrooms, 'id', 'name');
    if (state.teachers[0]) updateSubjectsForTeacher(state.teachers[0].id);
    $('#f-day').value = 'Понедельник';
    $('#f-week1').value = '';
    $('#f-week2').value = '';
    $('#f-type').value = 'Лекция';
    $('#btn-delete').classList.add('hidden');
    $('#modal').classList.remove('hidden');
}

function openEditModal(l) {
    $('#modal-title').textContent = 'Редактирование занятия';
    $('#lesson-id').value = l.id;
    fillSelect($('#f-group'), state.groups, 'id', 'name', l.group_id);
    fillSelect($('#f-teacher'), state.teachers, 'id', 'name', l.teacher_id);
    fillSelect($('#f-classroom'), state.classrooms, 'id', 'name', l.classroom_id);
    updateSubjectsForTeacher(l.teacher_id, l.subject_id);
    $('#f-day').value = l.day;
    $('#f-week1').value = l.week1_lesson || '';
    $('#f-week2').value = l.week2_lesson || '';
    $('#f-type').value = l.lesson_type || 'Лекция';
    $('#btn-delete').classList.remove('hidden');
    $('#modal').classList.remove('hidden');
}

function bindEvents() {
    $('#btn-add').addEventListener('click', openAddModal);
    $('#btn-cancel').addEventListener('click', () => $('#modal').classList.add('hidden'));

    $('#f-teacher').addEventListener('change', e => {
        updateSubjectsForTeacher(parseInt(e.target.value));
    });

    $('#lesson-form').addEventListener('submit', async e => {
        e.preventDefault();
        const id = $('#lesson-id').value;
        const body = {
            group_id: parseInt($('#f-group').value),
            day: $('#f-day').value,
            teacher_id: parseInt($('#f-teacher').value),
            subject_id: parseInt($('#f-subject').value),
            week1_lesson: $('#f-week1').value ? parseInt($('#f-week1').value) : null,
            week2_lesson: $('#f-week2').value ? parseInt($('#f-week2').value) : null,
            classroom_id: $('#f-classroom').value ? parseInt($('#f-classroom').value) : null,
            lesson_type: $('#f-type').value
        };
        const url = id ? `/api/schedule/${id}` : '/api/schedule';
        const method = id ? 'PUT' : 'POST';
        const res = await api(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            const c = res.data.conflicts || [res.data.error || 'Ошибка'];
            toast('⚠ ' + c.join('; '), 'error');
            return;
        }
        toast(id ? 'Занятие сохранено' : 'Занятие добавлено', 'success');
        $('#modal').classList.add('hidden');
        await loadAll();
    });

    $('#btn-delete').addEventListener('click', async () => {
        const id = $('#lesson-id').value;
        if (!id || !confirm('Удалить занятие?')) return;
        await api(`/api/schedule/${id}`, { method: 'DELETE' });
        toast('Занятие удалено', 'success');
        $('#modal').classList.add('hidden');
        await loadAll();
    });

    document.querySelectorAll('.week-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.week-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentWeek = parseInt(btn.dataset.week);
            renderBoard();
        });
    });

    $('#btn-stats').addEventListener('click', async () => {
        const res = await api('/api/stats/teachers');
        const stats = res.data || [];
        let html = '<table><tr><th>Преподаватель</th><th>Пар в неделю</th></tr>';
        if (stats.length === 0) {
            html += '<tr><td colspan="2" style="text-align:center;color:#94a3b8">Нет данных</td></tr>';
        }
        stats.forEach(s => {
            html += `<tr><td><span class="legend-dot" style="display:inline-block;background:${s.color};margin-right:8px"></span>${s.teacher}</td><td><b>${s.lessons_per_week}</b></td></tr>`;
        });
        html += '</table>';
        $('#stats-content').innerHTML = html;
        $('#stats-modal').classList.remove('hidden');
    });

    $('#btn-stats-close').addEventListener('click', () => {
        $('#stats-modal').classList.add('hidden');
    });

    $('#btn-save').addEventListener('click', () => {
        const data = JSON.stringify({
            groups: state.groups, teachers: state.teachers,
            subjects: state.subjects, classrooms: state.classrooms,
            lessons: state.lessons
        }, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'schedule.json';
        a.click();
        toast('Файл сохранён', 'success');
    });

    document.querySelectorAll('.modal').forEach(m => {
        m.addEventListener('click', e => {
            if (e.target === m) m.classList.add('hidden');
        });
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    loadAll();
});