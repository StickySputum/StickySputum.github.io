document.addEventListener("DOMContentLoaded", () => {
    // ВСТАВЬ СВОЮ НОВУЮ ССЫЛКУ ИЗ ГУГЛА СЮДА!
    const API_URL = "https://script.google.com/macros/s/AKfycbzaMi5vkLegAVb5ADnjVe-MPskotuffv_q0gSIDZXpS_IYzEqdWP56GCWetK0x_VGls/exec";
    
    let allUsers = {};
    let database = {}; 
    let currentUser = null;

    const mainApp = document.getElementById('mainApp');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const calendarElement = document.getElementById('calendar');
    const monthSelect = document.getElementById('month');
    const yearSelect = document.getElementById('year');
    const saveBtn = document.getElementById('saveScheduleBtn');

    // 1. ЗАГРУЗКА БАЗЫ
    async function initApp() {
        try {
            const response = await fetch(API_URL);
            const data = await response.json();
            
            allUsers = data.users;
            database = data.schedule;

            checkAuth();
        } catch (error) {
            console.error("Ошибка сети:", error);
            loadingOverlay.innerHTML = "<h2>Ошибка подключения к базе. Проверьте интернет.</h2>";
        }
    }

    // 2. АВТОРИЗАЦИЯ
    function checkAuth() {
        const savedPin = localStorage.getItem('userPin');
        if (savedPin && allUsers[savedPin]) {
            currentUser = { pin: savedPin, name: allUsers[savedPin].name };
            startApp();
        } else {
            login();
        }
    }

    function login() {
        const pin = prompt("Введите ваш PIN-код для входа:");
        if (pin && allUsers[pin]) {
            localStorage.setItem('userPin', pin);
            currentUser = { pin: pin, name: allUsers[pin].name };
            startApp();
        } else {
            alert("Неверный PIN-код или пользователь не найден в таблице.");
            loadingOverlay.innerHTML = `<h2>Доступ закрыт. <button onclick="location.reload()" style="padding:10px; margin-top:10px;">Попробовать снова</button></h2>`;
        }
    }

    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('userPin');
        location.reload();
    });

    function startApp() {
        loadingOverlay.style.display = 'none';
        mainApp.style.display = 'block';
        
        document.getElementById('roleDisplay').innerText = currentUser.name;
        
        const partnerPin = Object.keys(allUsers).find(p => p !== currentUser.pin);
        const partnerName = partnerPin ? allUsers[partnerPin].name : "Напарник";
        
        document.getElementById('legend-my-name').innerText = currentUser.name;
        document.getElementById('legend-partner-name').innerText = partnerName;

        initCalendarControls();
        renderCalendar();
    }

    // 3. ОТРИСОВКА И ЛОГИКА
    function initCalendarControls() {
        const currentDate = new Date();
        const months = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
        months.forEach((m, i) => monthSelect.add(new Option(m, i + 1)));
        for (let year = 2024; year <= 2030; year++) yearSelect.add(new Option(year, year));

        monthSelect.value = currentDate.getMonth() + 1;
        yearSelect.value = currentDate.getFullYear();
    }

    async function updateShiftOnServer(dateKey, action, name) {
        try {
            await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    date: dateKey,
                    action: action,
                    name: name
                })
            });
        } catch (error) {
            console.error("Ошибка отправки:", error);
        }
    }

    function handleSmartClick(cell, dateKey) {
        const shiftName = database[dateKey];
        const isMyShift = shiftName === currentUser.name;
        const isPartnerShift = shiftName && shiftName !== currentUser.name;

        if (!isMyShift && !isPartnerShift) {
            cell.className = 'day shift-mine';
            database[dateKey] = currentUser.name;
            updateShiftOnServer(dateKey, 'set', currentUser.name);
            return;
        }

        if (isMyShift) {
            cell.className = 'day';
            delete database[dateKey];
            updateShiftOnServer(dateKey, 'remove', currentUser.name);
            return;
        }

        if (isPartnerShift) {
            if (confirm(`В этот день работает ${shiftName}. Вы уверены, что хотите убрать эту смену?`)) {
                cell.className = 'day shift-mine';
                database[dateKey] = currentUser.name;
                updateShiftOnServer(dateKey, 'set', currentUser.name);
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
            calendarElement.appendChild(document.createElement('div'));
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = `${targetYear}-${targetMonth}-${day}`;
            const dayCell = document.createElement('div');
            dayCell.className = 'day';
            dayCell.innerText = day;
            
            const shiftName = database[dateKey];
            if (shiftName === currentUser.name) {
                dayCell.classList.add('shift-mine');
            } else if (shiftName && shiftName !== currentUser.name) {
                dayCell.classList.add('shift-partner');
            }

            dayCell.addEventListener('click', () => handleSmartClick(dayCell, dateKey));
            calendarElement.appendChild(dayCell);
        }
    }

    monthSelect.addEventListener('change', renderCalendar);
    yearSelect.addEventListener('change', renderCalendar);
    
    saveBtn.addEventListener('click', async () => {
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Загрузка...';
        const response = await fetch(API_URL);
        const data = await response.json();
        database = data.schedule;
        renderCalendar();
        saveBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-down"></i> Обновить данные';
    });

    initApp();
});