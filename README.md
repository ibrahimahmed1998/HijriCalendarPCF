# Hijri Calendar – PCF date picker for Dynamics 365 CE 9.1 (on-premises)

A Hijri (Umm al-Qura) date picker for a **Single Line of Text** field. Works like the normal CRM date
picker, but the calendar is Hijri. The selected date is saved into the text field as **`dd/MM/yyyy`**
(e.g. `15/03/1446`), always with Latin digits.

- Arabic users (language 1025) get Arabic month/day names and an RTL layout; others get English.
- Users can type a date (`15/3/1446`, `15-03-1446`, Arabic digits `١٥/٠٣/١٤٤٦` are accepted) or pick it.
- Optional Gregorian hint under the field (e.g. "Saturday, 1 March 2025").
- Supported range: 1300 – 1500 AH.
- Existing values that are not valid Hijri dates are shown as-is with a red border. They are never
  overwritten automatically.

## Files

| Path | What |
|---|---|
| `HijriCalendar_1_0_0_0_unmanaged.zip` | **The unmanaged solution to import** |
| `HijriDatePicker/HijriDatePicker/index.ts` | Control UI and lifecycle |
| `HijriDatePicker/HijriDatePicker/hijri.ts` | Umm al-Qura conversion, parse and format |
| `HijriDatePicker/HijriDatePicker/css`, `strings` | Styles, English (1033) and Arabic (1025) texts |
| `Solution/` | Solution project (publisher `HijriCalendar`, prefix `hc`) |
| `build.ps1` | Rebuilds everything and produces the zip |

## Import into CRM

1. **Settings → Solutions → Import**, choose `HijriCalendar_1_0_0_0_unmanaged.zip`, then click **Publish All Customizations**.
2. Open the form editor, double-click your text field, and go to the **Controls** tab → **Add Control…** → **Hijri Date Picker**.
3. Select the **Web** option (and Phone/Tablet if needed). Optionally set:
   - *Show Gregorian date*: leave empty to show it, type `No` to hide it
   - *First day of week*: type `Sunday`, `Monday` or `Saturday` (empty = Sunday)

   These settings are plain text because saving a 9.1 on-prem form fails on Yes/No and dropdown
   (TwoOptions/Enum) control settings.
4. **Save** and **Publish** the form.

The field should allow at least 10 characters.

### Troubleshooting

- **The field is still a plain textbox.** PCF controls render only in **Unified Interface** apps. In the
  9.1 legacy web client the field stays a normal text field.
- **Import fails with a language error.** The solution's base language must match your organization's
  base language. The zip is built for English (1033). If your org was installed with Arabic as its base
  language, run `.\build.ps1 -BaseLanguage 1025` and import the new zip.
- **Import fails with "XSD validation" on the control manifest.** Try the raw zip
  `Solution/bin/Release/Solution.zip` instead (see *Rebuild* below for the difference).
- **The red message "This browser does not support the Umm al-Qura calendar" appears.** The browser has
  no Umm al-Qura calendar data, so the control locks the field to avoid saving wrong dates. Use a current
  version of Edge, Chrome or Firefox.

## Rebuild

Requirements: Node.js, .NET SDK, Power Platform CLI (`pac`).

```powershell
.\build.ps1
```

`build.ps1` runs `dotnet build -c Release` on `Solution/`, which also builds the control in production
mode. It then copies the zip and removes these items from the control manifest inside it, because the 9.1
on-prem schema may reject them: the `api-version` attribute, and the `<external-service-usage>`,
`<feature-usage/>` and `<built-by>` elements. The raw, unmodified output stays in `Solution/bin/Release/Solution.zip`.

To debug in the browser test harness: `cd HijriDatePicker; npm start watch`.

When you change the control, bump `version` in `ControlManifest.Input.xml` (e.g. 1.0.1) so CRM picks up the new bundle.
