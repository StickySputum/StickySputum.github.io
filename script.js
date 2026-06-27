// ТУТ ВСТАВЬ СВОЙ URL ИЗ GOOGLE APPS SCRIPT
    const API_URL = "https://script.google.com/macros/s/AKfycbzaMi5vkLegAVb5ADnjVe-MPskotuffv_q0gSIDZXpS_IYzEqdWP56GCWetK0x_VGls/exec";
    
    let database = {}; // Сюда будем грузить данные из таблицы

    // Функция загрузки данных с сервера
    async function fetchSchedule() {
        try {
            // Показываем загрузку на кнопке
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Загрузка...';
            saveBtn.disabled = true;

            const response = await fetch(API_URL);
            database = await response.json();
            
            renderCalendar(); // Перерисовываем календарь с новыми данными
            
            // Возвращаем кнопку в норму
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
                // Отправляем как текст, чтобы избежать ошибки CORS политик браузера
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

    // Обновляем логику умного клика, чтобы она сразу отправляла данные
    function handleSmartClick(cell, dateKey) {
        const isWorker = cell.classList.contains('shift-worker');
        const isOwner = cell.classList.contains('shift-owner');
        const myRoleClass = `shift-${currentUser.role}`;
        const partnerRoleClass = currentUser.role === 'worker' ? 'shift-owner' : 'shift-worker';

        // Ситуация 1: Пусто -> Ставим смену
        if (!isWorker && !isOwner) {
            cell.classList.add(myRoleClass);
            database[dateKey] = currentUser.role;
            updateShiftOnServer(dateKey, 'set', currentUser.role); // Отправка на сервер
            return;
        }

        // Ситуация 2: Своя смена -> Убираем смену (выходной)
        if (cell.classList.contains(myRoleClass)) {
            cell.classList.remove(myRoleClass);
            delete database[dateKey];
            updateShiftOnServer(dateKey, 'remove', currentUser.role); // Удаление с сервера
            return;
        }

        // Ситуация 3: Чужая смена -> Всплывашка!
        if (cell.classList.contains(partnerRoleClass)) {
            const confirmChange = confirm("Внимание! В этот день уже стоит смена напарника.\nВы уверены, что хотите убрать её?");
            if (confirmChange) {
                cell.classList.remove(partnerRoleClass);
                cell.classList.add(myRoleClass);
                database[dateKey] = currentUser.role;
                updateShiftOnServer(dateKey, 'set', currentUser.role); // Перезапись на сервере
            }
        }
    }

    // Функция отрисовки (немного изменили, чтобы читала из database)
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
            // Форматируем дату точно так же, как она будет храниться
            const dateKey = `${targetYear}-${targetMonth}-${day}`;
            const dayCell = document.createElement('div');
            dayCell.className = 'day';
            dayCell.innerText = day;
            dayCell.dataset.date = dateKey;

            // Берем данные из database, а не из mockDatabase
            if (database[dateKey] === 'worker') dayCell.classList.add('shift-worker');
            if (database[dateKey] === 'owner') dayCell.classList.add('shift-owner');

            dayCell.addEventListener('click', () => handleSmartClick(dayCell, dateKey));
            calendarElement.appendChild(dayCell);
        }
    }

    monthSelect.addEventListener('change', renderCalendar);
    yearSelect.addEventListener('change', renderCalendar);

    // Кнопка теперь служит для принудительного обновления данных с сервера,
    // так как смены сохраняются автоматически при клике
    saveBtn.addEventListener('click', fetchSchedule);

    // Запускаем загрузку данных при открытии страницы
    fetchSchedule();