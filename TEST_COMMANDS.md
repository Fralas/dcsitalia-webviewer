# DCS Warehouse Viewer - Test Commands

## 🧪 Comandi per Generare Missioni di Test

### 1️⃣ Genera 5 missioni random (aeroporto casuale)
```bash
curl -X POST http://localhost:3001/api/test/generate-random-missions ^
  -H "Content-Type: application/json" ^
  -d "{\"count\": 5}"
```

### 2️⃣ Genera 10 missioni random per Incirlik
```bash
curl -X POST http://localhost:3001/api/test/generate-random-missions ^
  -H "Content-Type: application/json" ^
  -d "{\"count\": 10, \"airportId\": \"incirlik\"}"
```

### 3️⃣ Genera 10 missioni random per FOB Base
```bash
curl -X POST http://localhost:3001/api/test/generate-random-missions ^
  -H "Content-Type: application/json" ^
  -d "{\"count\": 10, \"airportId\": \"fob-base\"}"
```

### 4️⃣ Genera una missione specifica
```bash
curl -X POST http://localhost:3001/api/test/generate-mission ^
  -H "Content-Type: application/json" ^
  -d "{\"airportId\": \"incirlik\", \"weaponId\": \"weapons.missiles.AIM_120C\", \"currentQuantity\": 3}"
```

---

## 📋 ID degli Aeroporti Disponibili

- `adana-sakirpasa` - Adana Sakirpasa (BASE PRINCIPALE - non genera missioni)
- `incirlik` - Incirlik Air Base
- `fob-base` - FOB Base

---

## 🎯 Armi Disponibili per Test

- `weapons.missiles.AIM_120C`
- `weapons.missiles.AIM_9X`
- `weapons.missiles.AGM_65F`
- `weapons.missiles.AGM_88`
- `weapons.missiles.AGM_154A`
- `weapons.nurs.HYDRA_70_M151`
- `weapons.bombs.GBU_16`
- `weapons.missiles.RB75`
- `weapons.missiles.X_58`
- `weapons.nurs.C_13`

---

## 🔥 Quick Test - Genera un sacco di missioni!

```bash
curl -X POST http://localhost:3001/api/test/generate-random-missions ^
  -H "Content-Type: application/json" ^
  -d "{\"count\": 15, \"airportId\": \"incirlik\"}"
```

---

## ✅ Come Testare

1. **Apri il browser** su http://localhost:3000
2. **Vai alla sezione "Missions"** (nel menu in alto)
3. **Lancia uno dei comandi** qui sopra nel terminale (PowerShell o CMD)
4. **Guarda le missioni** apparire in tempo reale! 🎉

---

## 🧹 Pulizia

Le missioni scadono automaticamente dopo 24 ore, oppure puoi cancellarle dalla UI.

Se vuoi cancellare tutte le missioni manualmente, elimina il file:
```
data/historical/missions.json
```

E riavvia il server.
