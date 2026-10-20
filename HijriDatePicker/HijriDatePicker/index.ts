import { IInputs, IOutputs } from "./generated/ManifestTypes";
import {
    HijriDate,
    MAX_YEAR,
    MIN_YEAR,
    daysInMonth,
    formatHijri,
    isSameDate,
    isUmmAlQuraSupported,
    parseHijri,
    toGregorian,
    todayHijri,
} from "./hijri";

export class HijriDatePicker implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private context: ComponentFramework.Context<IInputs>;
    private notifyOutputChanged: () => void;

    private root: HTMLDivElement;
    private input: HTMLInputElement;
    private button: HTMLButtonElement;
    private hint: HTMLDivElement;
    private error: HTMLDivElement;
    private popup: HTMLDivElement | null = null;

    // Value pushed to CRM; rawValue holds the text last received from / sent to the field
    private outputValue: string | undefined;
    private rawValue: string | null = null;
    private selected: HijriDate | null = null;
    private viewYear = 0;
    private viewMonth = 0;
    private focusDay = 1;

    private isArabic = false;
    private disabled = false;
    private calendarUnsupported = false;

    private readonly onDocumentMouseDown = (e: MouseEvent): void => {
        const target = e.target as Node;
        if (this.popup && !this.root.contains(target) && !this.popup.contains(target)) {
            this.closePopup();
        }
    };

    // The popup lives on document.body (so form sections can't clip it); close it when the page moves
    private readonly onWindowMove = (e: Event): void => {
        if (this.popup && !(e.target instanceof Node && this.popup.contains(e.target))) {
            this.closePopup();
        }
    };

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        state: ComponentFramework.Dictionary,
        container: HTMLDivElement
    ): void {
        this.context = context;
        this.notifyOutputChanged = notifyOutputChanged;
        this.isArabic = context.userSettings.languageId === 1025 || context.userSettings.isRTL;

        this.root = document.createElement("div");
        this.root.className = "hdp-root";
        this.root.dir = this.isArabic ? "rtl" : "ltr";

        const box = document.createElement("div");
        box.className = "hdp-box";

        this.input = document.createElement("input");
        this.input.type = "text";
        this.input.className = "hdp-input";
        this.input.placeholder = this.str("Placeholder", "dd/mm/yyyy");
        this.input.setAttribute("aria-label", this.str("Value_Display_Key", "Hijri date"));
        this.input.autocomplete = "off";
        this.input.addEventListener("blur", () => this.commitTyped());
        this.input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                this.commitTyped();
            } else if (e.key === "ArrowDown" && e.altKey) {
                e.preventDefault();
                this.openPopup();
            }
        });

        this.button = document.createElement("button");
        this.button.type = "button";
        this.button.className = "hdp-button";
        this.button.title = this.str("OpenCalendar", "Open calendar");
        this.button.setAttribute("aria-label", this.button.title);
        this.button.innerHTML =
            '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M4 1h1v1h6V1h1v1h2.5c.28 0 .5.22.5.5v12c0 .28-.22.5-.5.5h-13a.5.5 0 0 1-.5-.5v-12c0-.28.22-.5.5-.5H4V1zm-2 5v8h12V6H2zm0-1h12V3H2v2zm2 3h2v2H4V8zm3 0h2v2H7V8zm3 0h2v2h-2V8z"/></svg>';
        this.button.addEventListener("click", () => (this.popup ? this.closePopup() : this.openPopup()));

        box.appendChild(this.input);
        box.appendChild(this.button);

        this.hint = document.createElement("div");
        this.hint.className = "hdp-hint";
        this.error = document.createElement("div");
        this.error.className = "hdp-error";

        this.root.appendChild(box);
        this.root.appendChild(this.hint);
        this.root.appendChild(this.error);
        container.appendChild(this.root);

        document.addEventListener("mousedown", this.onDocumentMouseDown, true);
        window.addEventListener("scroll", this.onWindowMove, true);
        window.addEventListener("resize", this.onWindowMove);

        if (!isUmmAlQuraSupported()) {
            this.calendarUnsupported = true;
            this.error.textContent = this.str("Unsupported", "This browser does not support the Umm al-Qura calendar.");
            this.root.classList.add("hdp-invalid");
        }
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this.context = context;
        // Without Umm al-Qura data, Intl silently falls back to Gregorian, so lock the field to avoid saving wrong dates
        this.disabled = context.mode.isControlDisabled || this.calendarUnsupported;
        this.input.readOnly = this.disabled;
        this.button.style.display = this.disabled ? "none" : "";
        this.root.classList.toggle("hdp-disabled", this.disabled);
        this.root.style.display = context.mode.isVisible === false ? "none" : "";
        if (this.disabled) {
            this.closePopup();
        }

        const incoming = context.parameters.value.raw;
        if (incoming !== this.rawValue) {
            this.rawValue = incoming;
            this.outputValue = incoming ?? undefined;
            // Show whatever is stored; unparseable legacy values are displayed as-is and flagged, never rewritten
            this.input.value = incoming ?? "";
            if (!this.calendarUnsupported) {
                this.selected = parseHijri(incoming);
                this.setError(!!incoming && !this.selected);
            }
        }
        this.updateHint();
    }

    public getOutputs(): IOutputs {
        return { value: this.outputValue };
    }

    public destroy(): void {
        document.removeEventListener("mousedown", this.onDocumentMouseDown, true);
        window.removeEventListener("scroll", this.onWindowMove, true);
        window.removeEventListener("resize", this.onWindowMove);
        this.closePopup();
    }

    // ---- value handling ----

    private commitTyped(): void {
        if (this.disabled) {
            return;
        }
        const text = this.input.value.trim();
        if (text === (this.rawValue ?? "")) {
            return;
        }
        if (!text) {
            this.setValue(null);
            return;
        }
        const parsed = parseHijri(text);
        if (parsed) {
            this.setValue(parsed);
        } else {
            this.setError(true);
        }
    }

    private setValue(date: HijriDate | null): void {
        this.selected = date;
        const text = date ? formatHijri(date) : null;
        this.rawValue = text;
        this.outputValue = text ?? undefined;
        this.input.value = text ?? "";
        this.setError(false);
        this.updateHint();
        this.notifyOutputChanged();
    }

    private setError(on: boolean): void {
        this.root.classList.toggle("hdp-invalid", on);
        this.error.textContent = on ? this.str("InvalidDate", "Enter a valid Hijri date (dd/mm/yyyy).") : "";
    }

    private updateHint(): void {
        // Text input: anything except an explicit "no" shows the hint
        const setting = (this.context.parameters.showGregorian?.raw ?? "").trim().toLowerCase();
        const show = ["false", "no", "0", "off", "لا"].indexOf(setting) < 0;
        if (show && this.selected) {
            const g = new Date(toGregorian(this.selected));
            this.hint.textContent = g.toLocaleDateString(this.isArabic ? "ar-u-ca-gregory-nu-latn" : "en-GB", {
                timeZone: "UTC",
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
            });
        } else {
            this.hint.textContent = "";
        }
    }

    // ---- popup ----

    private openPopup(): void {
        if (this.disabled || this.popup) {
            return;
        }
        const base = this.selected ?? todayHijri();
        this.viewYear = Math.min(MAX_YEAR, Math.max(MIN_YEAR, base.year));
        this.viewMonth = base.month;
        this.focusDay = base.day;

        this.popup = document.createElement("div");
        this.popup.className = "hdp-popup";
        this.popup.dir = this.root.dir;
        this.popup.setAttribute("role", "dialog");
        this.popup.addEventListener("keydown", (e) => this.onPopupKey(e));
        document.body.appendChild(this.popup);
        this.renderPopup(true);
    }

    /** Places the fixed-position popup under the field (or above it when there is no room below). */
    private positionPopup(): void {
        if (!this.popup) {
            return;
        }
        const anchor = (this.input.parentElement as HTMLElement).getBoundingClientRect();
        const width = this.popup.offsetWidth;
        const height = this.popup.offsetHeight;
        const viewWidth = document.documentElement.clientWidth;
        const viewHeight = document.documentElement.clientHeight;

        let left = this.isArabic ? anchor.right - width : anchor.left;
        left = Math.max(4, Math.min(left, viewWidth - width - 4));
        let top = anchor.bottom + 2;
        if (top + height > viewHeight && anchor.top - height - 2 >= 0) {
            top = anchor.top - height - 2;
        }
        this.popup.style.left = `${left}px`;
        this.popup.style.top = `${top}px`;
    }

    private closePopup(): void {
        if (this.popup) {
            this.popup.remove();
            this.popup = null;
        }
    }

    private monthNames(): string[] {
        return this.isArabic
            ? ["محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"]
            : ["Muharram", "Safar", "Rabi' al-Awwal", "Rabi' al-Thani", "Jumada al-Ula", "Jumada al-Akhirah", "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"];
    }

    private weekdayNames(): string[] {
        // Indexed by JS getUTCDay(): 0 = Sunday
        return this.isArabic
            ? ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"]
            : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    }

    private weekStart(): number {
        // Text input: accepts a day name (English/Arabic) or a JS weekday number; defaults to Sunday
        const setting = (this.context.parameters.weekStart?.raw ?? "").trim().toLowerCase();
        if (["saturday", "sat", "6", "السبت"].indexOf(setting) >= 0) {
            return 6;
        }
        if (["monday", "mon", "1", "الإثنين", "الاثنين"].indexOf(setting) >= 0) {
            return 1;
        }
        return 0;
    }

    private renderPopup(focusGrid: boolean): void {
        const popup = this.popup;
        if (!popup) {
            return;
        }
        popup.innerHTML = "";
        const rtl = this.isArabic;

        // Header: prev / month select / year select / next
        const header = document.createElement("div");
        header.className = "hdp-header";
        const prev = this.navButton(rtl ? "›" : "‹", this.str("PrevMonth", "Previous month"), -1);
        const next = this.navButton(rtl ? "‹" : "›", this.str("NextMonth", "Next month"), 1);

        const monthSelect = document.createElement("select");
        monthSelect.className = "hdp-select";
        monthSelect.setAttribute("aria-label", this.str("Month", "Month"));
        this.monthNames().forEach((name, i) => monthSelect.add(new Option(name, String(i + 1), false, i + 1 === this.viewMonth)));
        monthSelect.addEventListener("change", () => {
            this.viewMonth = parseInt(monthSelect.value, 10);
            this.clampFocus();
            this.renderPopup(false);
        });

        const yearSelect = document.createElement("select");
        yearSelect.className = "hdp-select";
        yearSelect.setAttribute("aria-label", this.str("Year", "Year"));
        for (let y = MIN_YEAR; y <= MAX_YEAR; y++) {
            yearSelect.add(new Option(String(y), String(y), false, y === this.viewYear));
        }
        yearSelect.addEventListener("change", () => {
            this.viewYear = parseInt(yearSelect.value, 10);
            this.clampFocus();
            this.renderPopup(false);
        });

        header.appendChild(prev);
        header.appendChild(monthSelect);
        header.appendChild(yearSelect);
        header.appendChild(next);
        popup.appendChild(header);

        // Day grid
        const grid = document.createElement("div");
        grid.className = "hdp-grid";
        grid.setAttribute("role", "grid");
        const names = this.weekdayNames();
        const start = this.weekStart();
        for (let i = 0; i < 7; i++) {
            const wd = document.createElement("div");
            wd.className = "hdp-weekday";
            wd.textContent = names[(start + i) % 7];
            grid.appendChild(wd);
        }

        const firstWeekday = new Date(toGregorian({ year: this.viewYear, month: this.viewMonth, day: 1 })).getUTCDay();
        const offset = (firstWeekday - start + 7) % 7;
        for (let i = 0; i < offset; i++) {
            grid.appendChild(document.createElement("div"));
        }

        const today = todayHijri();
        const count = daysInMonth(this.viewYear, this.viewMonth);
        let focusEl: HTMLButtonElement | null = null;
        for (let d = 1; d <= count; d++) {
            const date: HijriDate = { year: this.viewYear, month: this.viewMonth, day: d };
            const cell = document.createElement("button");
            cell.type = "button";
            cell.className = "hdp-day";
            cell.textContent = String(d);
            cell.tabIndex = d === this.focusDay ? 0 : -1;
            const g = new Date(toGregorian(date));
            cell.title = g.toLocaleDateString(this.isArabic ? "ar-u-ca-gregory-nu-latn" : "en-GB", {
                timeZone: "UTC",
                day: "numeric",
                month: "short",
                year: "numeric",
            });
            if (isSameDate(date, today)) {
                cell.classList.add("hdp-today");
            }
            if (isSameDate(date, this.selected)) {
                cell.classList.add("hdp-selected");
                cell.setAttribute("aria-selected", "true");
            }
            cell.addEventListener("click", () => this.pick(date));
            if (d === this.focusDay) {
                focusEl = cell;
            }
            grid.appendChild(cell);
        }
        popup.appendChild(grid);

        // Footer
        const footer = document.createElement("div");
        footer.className = "hdp-footer";
        const todayBtn = document.createElement("button");
        todayBtn.type = "button";
        todayBtn.className = "hdp-link";
        todayBtn.textContent = this.str("Today", "Today");
        todayBtn.addEventListener("click", () => this.pick(todayHijri()));
        const clearBtn = document.createElement("button");
        clearBtn.type = "button";
        clearBtn.className = "hdp-link";
        clearBtn.textContent = this.str("Clear", "Clear");
        clearBtn.addEventListener("click", () => {
            this.setValue(null);
            this.closePopup();
            this.input.focus();
        });
        footer.appendChild(todayBtn);
        footer.appendChild(clearBtn);
        popup.appendChild(footer);
        // Row count (5 or 6 weeks) changes the height, so re-place on every render
        this.positionPopup();

        if (focusGrid && focusEl) {
            (focusEl as HTMLButtonElement).focus();
        }
    }

    private navButton(label: string, title: string, delta: number): HTMLButtonElement {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "hdp-nav";
        btn.textContent = label;
        btn.title = title;
        btn.setAttribute("aria-label", title);
        btn.disabled = (delta < 0 && this.viewYear === MIN_YEAR && this.viewMonth === 1) || (delta > 0 && this.viewYear === MAX_YEAR && this.viewMonth === 12);
        btn.addEventListener("click", () => {
            this.shiftMonth(delta);
            this.renderPopup(false);
        });
        return btn;
    }

    private shiftMonth(delta: number): void {
        const index = this.viewYear * 12 + (this.viewMonth - 1) + delta;
        const year = Math.floor(index / 12);
        if (year < MIN_YEAR || year > MAX_YEAR) {
            return;
        }
        this.viewYear = year;
        this.viewMonth = (index % 12) + 1;
        this.clampFocus();
    }

    private clampFocus(): void {
        this.focusDay = Math.min(this.focusDay, daysInMonth(this.viewYear, this.viewMonth));
    }

    private onPopupKey(e: KeyboardEvent): void {
        if (e.key === "Escape") {
            e.preventDefault();
            this.closePopup();
            this.input.focus();
            return;
        }
        const target = e.target as HTMLElement;
        if (!target.classList.contains("hdp-day")) {
            return;
        }
        const forward = this.isArabic ? -1 : 1;
        const moves: Record<string, number> = {
            ArrowLeft: -forward,
            ArrowRight: forward,
            ArrowUp: -7,
            ArrowDown: 7,
        };
        if (e.key === "PageUp" || e.key === "PageDown") {
            e.preventDefault();
            this.shiftMonth(e.key === "PageUp" ? -1 : 1);
            this.renderPopup(true);
            return;
        }
        const step = moves[e.key];
        if (step === undefined) {
            return;
        }
        e.preventDefault();
        const count = daysInMonth(this.viewYear, this.viewMonth);
        const startYear = this.viewYear;
        const startMonth = this.viewMonth;
        let day = this.focusDay + step;
        if (day < 1) {
            this.shiftMonth(-1);
            if (this.viewYear !== startYear || this.viewMonth !== startMonth) {
                day += daysInMonth(this.viewYear, this.viewMonth);
            }
        } else if (day > count) {
            this.shiftMonth(1);
            if (this.viewYear !== startYear || this.viewMonth !== startMonth) {
                day -= count;
            }
        }
        this.focusDay = Math.max(1, Math.min(day, daysInMonth(this.viewYear, this.viewMonth)));
        this.renderPopup(true);
    }

    private pick(date: HijriDate): void {
        this.setValue(date);
        this.closePopup();
        this.input.focus();
    }

    private str(key: string, fallback: string): string {
        const value = this.context.resources.getString(key);
        return value && value !== key ? value : fallback;
    }
}
