# 🪟 Guida Hosting su Windows

Questa guida spiega come configurare e avviare il DCS Warehouse Viewer su Windows per l'accesso online.

## 📋 Prerequisiti

1. **Node.js** (v18 o superiore)
   - Scarica da: https://nodejs.org/
   - Verifica installazione: `node --version`

2. **PM2** (opzionale, per gestione avanzata)
   ```bash
   npm install -g pm2
   npm install -g pm2-windows-startup
   pm2-startup install
   ```

## 🚀 Avvio Rapido

### Metodo 1: Script Semplice (Consigliato per Test)

1. Fai doppio clic su `start-server-windows.bat`
2. Apri il browser su `http://localhost:3001`
3. Premi CTRL+C per fermare il server

### Metodo 2: PM2 (Consigliato per Produzione)

1. Fai doppio clic su `start-server-pm2-windows.bat`
2. Il server si avvierà in background
3. Apri il browser su `http://localhost:3001`

Comandi PM2 utili:
```bash
pm2 status                    # Stato del server
pm2 logs dcs-warehouse        # Visualizza log
pm2 restart dcs-warehouse     # Riavvia
pm2 stop dcs-warehouse        # Ferma
pm2 save                      # Salva configurazione
```

## 🌐 Configurazione per Accesso Online

### 1. Configurazione Firewall Windows

Apri PowerShell come Amministratore:

```powershell
# Consenti porta 3001 in entrata
New-NetFirewallRule -DisplayName "DCS Warehouse Viewer" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow
```

### 2. Port Forwarding sul Router

1. Accedi al pannello del tuo router (solitamente `192.168.1.1` o `192.168.0.1`)
2. Trova la sezione "Port Forwarding" o "Virtual Server"
3. Aggiungi una regola:
   - **Porta Esterna**: 3001
   - **Porta Interna**: 3001
   - **IP Interno**: L'IP del tuo PC Windows (trova con `ipconfig`)
   - **Protocollo**: TCP

### 3. DNS Dinamico (Se non hai IP Statico)

Usa un servizio gratuito come **DuckDNS**:

1. Vai su https://www.duckdns.org/
2. Crea un account e ottieni un dominio gratuito (es. `mio-dcs.duckdns.org`)
3. Scarica il client DuckDNS per Windows
4. Configura l'aggiornamento automatico dell'IP

### 4. Configurazione Ambiente (.env)

Modifica `backend/.env`:

```env
NODE_ENV=production
PORT=3001

# Imposta il tuo dominio o IP pubblico
FRONTEND_URL=http://tuo-dominio.duckdns.org:3001

# IMPORTANTE: Cambia queste password!
JWT_SECRET=genera-una-chiave-segreta-casuale-qui
ADMIN_PASSWORD=la-tua-password-admin-sicura
```

## 🔒 Sicurezza

⚠️ **IMPORTANTE**: Prima di esporre il server online:

1. **Cambia le password** in `backend/.env`:
   - `JWT_SECRET`: Usa una stringa casuale lunga
   - `ADMIN_PASSWORD`: Usa una password forte

2. **Firewall**: Assicurati che solo la porta 3001 sia aperta

3. **Backup**: Fai backup regolari dei file CSV

4. **Updates**: Mantieni Node.js aggiornato

## 📱 Accesso da Altri Dispositivi

### Rete Locale

Trova l'IP del tuo PC con `ipconfig`:
```
IPv4 Address: 192.168.1.100
```

Accedi da altri dispositivi sulla stessa rete:
```
http://192.168.1.100:3001
```

### Internet

Usa il tuo IP pubblico o dominio DuckDNS:
```
http://tuo-ip-pubblico:3001
http://tuo-dominio.duckdns.org:3001
```

## 🐛 Risoluzione Problemi

### Il server non si avvia

1. Verifica che Node.js sia installato: `node --version`
2. Verifica che la porta 3001 non sia già in uso
3. Controlla i log in `backend/logs/`

### Non riesco ad accedere da Internet

1. Verifica che il firewall Windows consenta la porta 3001
2. Controlla il port forwarding sul router
3. Verifica il tuo IP pubblico su https://whatismyip.com/
4. Assicurati che il tuo ISP non blocchi le porte in entrata

### Problemi con PM2

```bash
# Reinstalla PM2
npm uninstall -g pm2
npm install -g pm2
npm install -g pm2-windows-startup
pm2-startup install
```

## 📊 Monitoraggio

Con PM2 puoi monitorare il server:

```bash
pm2 monit                # Monitor interattivo
pm2 logs dcs-warehouse   # Log in tempo reale
pm2 status               # Stato processi
```

## 🔄 Aggiornamenti

Quando aggiorni il codice:

```bash
# Con script semplice: riavvia lo script
# Con PM2:
npm run build
pm2 restart dcs-warehouse
```

## 💡 Consigli

- **Produzione**: Usa PM2 per auto-restart e gestione processi
- **Sviluppo**: Usa lo script semplice per test rapidi
- **SSL/HTTPS**: Considera Cloudflare Tunnel per HTTPS gratuito
- **Performance**: PM2 gestisce meglio crash e riavvii automatici

## 📞 Supporto

Per problemi o domande, controlla:
- I log del server
- La configurazione firewall
- Le impostazioni del router
