document.addEventListener("DOMContentLoaded", () => {
    // 1. СИСТЕМА РОЛЕЙ И АВТОРИЗАЦИИ
    const PINS = {
        "1111": { role: "worker", name: "Сменщик" },
        "2222": { role: "owner", name: "Владелец" }
    };

    let currentUser = null;

    function checkAuth() {
        const savedPin = localStorage.getItem('userPin');
        if (savedPin && PINS[savedPin]) {
            currentUser = PINS[savedPin];
            document.getElementById('roleDisplay').innerText = currentUser.name;
        } else {
            login();
        }
    }

    function login() {
        const pin = prompt("Введите PIN для входа:\n(Для теста: 1111 - Сменщик, 2222 - Владелец)");
        if (pin && PINS[pin]) {
            localStorage.setItem('userPin', pin);
            currentUser = PINS[pin];
            document.getElementById('roleDisplay').innerText = currentUser.name;
        } else {
            alert("Неверный PIN! Доступ закрыт.");
            document.body.innerHTML = "<h2 style='text-align:center; margin-top:50px;'>Доступ закрыт. Обновите страницу.</h2>";
        }
    }

    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('userPin');
        location.reload();
    });

    checkAuth(); // Проверяем логин при загрузке
    if (!currentUser) return; // Если не вошли, стопаем скрипт

    // 2. ИНИЦИАЛИЗАЦИЯ ИНТЕРФЕЙСА (Поиск кнопок и списков)
    const calendarElement = document.getElementById('calendar');
    const monthSelect = document.getElementById('month');
    const yearSelect = document.getElementById('year');
    const saveBtn = document.getElementById('saveScheduleBtn');

    // Заполнение списков годов и месяцев
    const currentDate = new Date();
    const months = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
    months.forEach((m, i) => monthSelect.add(new Option(m, i + 1)));
    for (let year = 2024; year <= 2030; year++) yearSelect.add(new Option(year, year));

    monthSelect.value = currentDate.getMonth() + 1;
    yearSelect.value = currentDate.getFullYear();

    // 3. РАБОТА С GOOGLE СЕРВЕРОМ
    const API_URL = "https://script.google.com/macros/s/AKfycbzaMi5vkLegAVb5ADnjVe-MPskotuffv_q0gSIDZXpS_IYzEqdWP56GCWetK0x_VGls/exec";
    
    let database = {}; // Сюда будем грузить данные из таблицы

    // Функция загрузки данных с сервера
    async function fetchSchedule() {
        try {
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Загрузка...';
            saveBtn.disabled = true;

            const response = await fetch(API_URL);
            database = await response.json();
            
            renderCalendar(); // Перерисовываем календарь с новыми данными
            
            saveBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-down"></i> Обновить данные';
            saveBtn.disabled = false;
        } catch (error) {
            console.error("Ошибка загрузки:", error);
            alert("Не удалось загрузить расписание. Проверьте интернет.");
        }
    }

    // Функция отправки одного изменения на сервер
    async function updateShiftOnServer(dateKey, action, role) {
        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    date: dateKey,
                    action: action,
                    role: role
                })
            });
            const result = await response.json();
            if (result.status !== "success") {
                console.error("Ошибка сохранения на сервере");
            }
        } catch (error) {
            console.error("Ошибка сети при отправке:", error);
        }
    }

    // 4. ЛОГИКА КЛИКОВ И ОТРИСОВКИ
    function handleSmartClick(cell, dateKey) {
        const isWorker = cell.classList.contains('shift-worker');
        const isOwner = cell.classList.contains('shift-owner');
        const myRoleClass = `shift-${currentUser.role}`;
        const partnerRoleClass = currentUser.role === 'worker' ? 'shift-owner' : 'shift-worker';

        // Ситуация 1: Пусто -> Ставим смену
        if (!isWorker && !isOwner) {
            cell.classList.add(myRoleClass);
            database[dateKey] = currentUser.role;
            updateShiftOnServer(dateKey, 'set', currentUser.role); 
            return;
        }

        // Ситуация 2: Своя смена -> Убираем смену (выходной)
        if (cell.classList.contains(myRoleClass)) {
            cell.classList.remove(myRoleClass);
            delete database[dateKey];
            updateShiftOnServer(dateKey, 'remove', currentUser.role);
            return;
        }

        // Ситуация 3: Чужая смена -> Всплывашка!
        if (cell.classList.contains(partnerRoleClass)) {
            const confirmChange = confirm("Внимание! В этот день уже стоит смена напарника.\nВы уверены, что хотите убрать её?");
            if (confirmChange) {
                cell.classList.remove(partnerRoleClass);
                cell.classList.add(myRoleClass);
                database[dateKey] = currentUser.role;
                updateShiftOnServer(dateKey, 'set', currentUser.role);
            }
        }
    }

    function renderCalendar() {
        calendarElement.innerHTML = '';
        const targetYear = parseInt(yearSelect.value);
        const targetMonth = parseInt(monthSelect.value);
        
        const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
        weekDays.forEach(day => {
            const el = document.createElement('div');
            el.className = 'header-day';
            el.innerText = day;
            calendarElement.appendChild(el);
        });

        const firstDay = new Date(targetYear, targetMonth - 1, 1);
        const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
        let startDayWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

        for (let i = 0; i < startDayWeek; i++) {
            const emptyCell = document.createElement('div');
            calendarElement.appendChild(emptyCell);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = `${targetYear}-${targetMonth}-${day}`;
            const dayCell = document.createElement('div');
            dayCell.className = 'day';
            dayCell.innerText = day;
            dayCell.dataset.date = dateKey;

            if (database[dateKey] === 'worker') dayCell.classList.add('shift-worker');
            if (database[dateKey] === 'owner') dayCell.classList.add('shift-owner');

            dayCell.addEventListener('click', () => handleSmartClick(dayCell, dateKey));
            calendarElement.appendChild(dayCell);
        }
    }

    monthSelect.addEventListener('change', renderCalendar);
    yearSelect.addEventListener('change', renderCalendar);
    saveBtn.addEventListener('click', fetchSchedule);

    // Запускаем загрузку при старте
    fetchSchedule();
});