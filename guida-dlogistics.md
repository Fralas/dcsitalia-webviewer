# DLOGISTICS — Creazione ordine e ritiro in game

**DLOGISTICS** è il sistema di rifornimento della campagna **HIDC**. Collega il negozio logistica del sito al server DCS: crei un ordine su una base BLUE, ottieni un codice e in game lo ritiri con un comando in chat. Il carico compare a terra, pronto da caricare e portare a destinazione.

I punti non vengono scalati quando confermi l’ordine sul sito. **DLOGISTICS** li detrae dai **Punti fazione BLUE** al momento del ritiro.

---

## In sintesi

1. Entra nella campagna **HIDC**, apri la mappa tattica e accedi con **Discord**.
2. Apri un aeroporto **BLUE** e vai alla scheda **Logistica**.
3. Metti nel carrello container o casse e premi **Conferma ordine**.
4. Copia il **Codice** a 6 caratteri.
5. Entra sul server DCS della campagna HIDC.
6. In chat scrivi:

```text
LOG ABCDEF
```

Sostituisci `ABCDEF` con il codice del tuo ordine.

7. **DLOGISTICS** genera il carico. L’ordine scompare dalla lista sul sito: è stato ritirato.

---

## Cosa ti serve

- Account **Discord** e login sul sito (senza accesso il negozio non è disponibile).
- Una base **BLUE**. Il negozio si apre solo sulle basi della coalizione BLUE.
- Essere sul **server DCS della campagna HIDC** per il ritiro.
- **Punti fazione BLUE** sufficienti al momento del ritiro (il saldo è collettivo della fazione, non del singolo pilota).

Non serve uno squadrone e non serve collegare lo UCID. Il codice ordine è l’unico elemento da portare in game.

---

## 1. Creare un ordine sul sito

1. Dalla home, apri **HIDC - High Intensity Dynamic Campaign** e poi la **mappa tattica**.
2. Accedi con Discord.
3. Clicca l’aeroporto **BLUE** che deve ricevere il rifornimento. L’ordine resta legato a quella base: è la destinazione del carico.
4. Apri la scheda **Logistica**.
5. Usa **Cerca cargo…** se cerchi un preset specifico.
6. Clicca gli articoli per aggiungerli al **Carrello**. Puoi aumentare o diminuire le quantità.
7. Controlla **Totale** (punti fazione) e **Peso**.
8. Premi **Conferma ordine**.

L’ordine compare in **Ordini confermati**, sia nella scheda Overview sia in Logistica, con il codice da copiare.

> Il sito **non blocca** l’ordine se i punti fazione sono bassi: il costo è solo un’anteprima. Se al ritiro i punti non bastano, **DLOGISTICS** rifiuta il codice e il carico non spawna.

---

## 2. Il codice ordine

Ogni ordine ha un **codice di 6 caratteri**, ad esempio `A3K9XP`.

- Clicca su **Codice XXXXXX** per copiarlo (suggerimento: *Copia codice ordine*).
- Non usa `0`, `1`, `I` e `O`, per evitare scambi in chat.
- Il codice è l’unico dato che serve in game. Non serve ripetere il nome della base o il contenuto dell’ordine.

Finché l’ordine non viene ritirato, resta visibile nella lista della base. Dopo il ritiro sparisce da solo.

---

## 3. Ritiro in game con DLOGISTICS

**DLOGISTICS** è il modulo in missione che legge gli ordini aperti del sito e li consegna quando un pilota usa il comando.

### Comando

Nella **chat di DCS** scrivi `LOG`, uno spazio e il codice:

```text
LOG A3K9XP
```

Esempio: se il sito mostra `Codice K7M2W4`, in chat vai:

```text
LOG K7M2W4
```

### Cosa succede

1. **DLOGISTICS** verifica che il codice esista e non sia già stato usato.
2. Controlla che i **Punti fazione BLUE** coprano il costo dell’ordine.
3. Spawna a terra il carico (container e/o casse) per il caricamento.
4. Scala i punti fazione.
5. Il sito marca l’ordine come completato: sparisce da **Ordini confermati**.

### Dopo il ritiro

Carica il materiale sul velivolo logistico e portalo alla base per cui è stato creato l’ordine. Sulla mappa tattica, le basi da cui parte il traffico C-130 sono etichettate **LOGI HUB**.

---

## Tipi di carico

Il negozio è organizzato in tre famiglie. Il costo è in **Punti fazione BLUE** per ogni pezzo.

| Tipo | Costo | Trasporto | A cosa serve |
|------|------:|-----------|--------------|
| **Container** | 4 | Solo C-130J | Grandi lotti di munizioni per aerei |
| **Small Container** | 2 | Solo C-130J | Lotti intermedi (anche munizioni elicottero) |
| **Cassa** | 1 | C-130J, CH-47F, UH-1H, Mi-8 | Rifornimenti piccoli, adatti anche agli elicotteri |

Nell’elenco, l’icona dell’aereo indica il C-130. Se c’è anche l’icona dell’elicottero, quella voce è una **cassa** e può viaggiare sui rotary.

### Container (4 punti)

| Preset | Contenuto |
|--------|-----------|
| Container AA_New | AIM-120C ×34 · AIM-9X ×20 · AIM-9M ×10 |
| Container AA_Old | AIM-54C ×8 · AIM-7P ×10 · AIM-9M ×10 |
| Container_AG_GPS 1 | GBU-38 ×45 · GBU-31 ×20 |
| Container_AG_GPS 2 | CBU-105 ×50 · GBU-54 ×56 |
| Container_AG_LGB 1 | GBU-12 ×5 · GBU-24 ×2 |
| Container_AG_Glide 1 | AGM-154A ×3 · AGM-154C ×3 |
| Container_AG_Cruise 1 | AGM-84H ×10 · AGM-84D ×3 |
| Container_AG_Maverick 1 | AGM-65H ×30 · AGM-65D ×26 |
| Container_AG_Maverick 2 | AGM-65E ×30 · AGM-65K ×28 |
| Container_AG_Hellfire | AGM-114L ×200 · AGM-114K ×188 |
| Container_AG_SEAD1 | AGM-88C ×10 · AGM-122 ×5 |
| Container_AG_Rockets | Hydra 70 ×500 · APKWS ×167 |
| Container_ASW | AGM-84D ×28 |
| Container_AG_Rus | 9M120 ×100 · S-8 ×252 |

### Small Container (2 punti)

| Preset | Contenuto |
|--------|-----------|
| Small Container AG Heli | AGM-114L ×100 · AGM-114K ×100 · Hydra 70 ×60 |
| Small Container GPS 1 | GBU-38 ×40 · CBU-105 ×23 |

### Casse (1 punto)

| Preset | Contenuto |
|--------|-----------|
| Crate_120 | AIM-120C ×8 |
| Crate_9X | AIM-9X ×14 |
| Crate_GBU38 | GBU-38 ×5 |
| Crate_GBU54 | GBU-54 ×5 |
| Crate_CBU105 | CBU-105 ×3 |
| Crate_AGM65D | AGM-65D ×6 |
| Crate_AGM65F | AGM-65F ×4 |
| Crate_AGM114K | AGM-114K ×14 |
| Crate_AGM114L | AGM-114L ×14 |
| Crate_AGM88 | AGM-88C ×3 |
| Crate_Hydra | Hydra 70 ×14 |
| Crate_APKWS | APKWS ×14 |
| Crate_Ataka | 9M120 ×14 |
| Crate_S8FP2 | S-8 ×14 |

---

## Quale velivolo usare

| Mezzo | Cosa può trasportare |
|-------|----------------------|
| **C-130J** | Container, Small Container e casse |
| **CH-47F**, **UH-1H**, **Mi-8** | Solo **casse**. Se l’ordine contiene anche un container, non è adatto all’elicottero |

Se devi rifornire una base con soli elicotteri o un FOB, ordina **casse**. Se serve un rifornimento pesante su una pista, usa i **container** e un C-130.

---

## Trovare gli ordini sulla mappa

Sulla mappa tattica, il pannello di destra ha la scheda **Logistica**:

1. Scegli il **mezzo** (C-130J, CH-47F, UH-1H o Mi-8).
2. In **Partenza** puoi selezionare solo una **LOGI HUB**.
3. In **Arrivo** compaiono solo le basi che hanno **ordini aperti** compatibili con quel mezzo.

Così vedi subito dove c’è da ritirare e dove consegnare, senza aprire ogni aeroporto.

Le basi con **LOGI HUB** nel titolo del pannello aeroporto sono gli hub da cui opera il C-130.

---

## Gestire un ordine già creato

Nella lista **Ordini confermati**:

| Azione | Quando usarla |
|--------|----------------|
| **Modifica** | L’ordine è ancora aperto e vuoi cambiare gli articoli. Poi **Salva ordine**. |
| **Annulla ordine** | L’ordine non è ancora stato preso in carico e non ti serve più. Nessun rimborso: i punti non erano ancora stati scalati. |
| **Accetta** | Segnala sul sito che qualcuno sta prendendo in carico la consegna. **Non è obbligatorio** per usare `LOG` in game. |
| **Annulla** (dopo Accetta) | Rilascia l’ordine, torna disponibile. |
| **Completa** | Chiusura manuale sul sito. **Non usarla** se intendi ritirare il carico in game: il codice smette di funzionare. |

Il ritiro con `LOG` chiude da solo l’ordine. Non serve premere Completa.

Una base può avere al massimo **80** ordini aperti.

---

## Punti fazione BLUE

- Valuta collettiva della coalizione BLUE nella campagna HIDC (la stessa che vedi in game / F10).
- Il sito mostra il saldo attuale come riferimento.
- Il pagamento avviene **solo al ritiro** tramite **DLOGISTICS**.
- Annullare un ordine sul sito non sposta punti, perché non erano ancora stati spesi.
- Se il ritiro fallisce per punti insufficienti, l’ordine resta valido: puoi ritentare quando la fazione ha di nuovo credito.

---

## Problemi frequenti

**Il negozio chiede di accedere.**  
Fai login con Discord e riprova.

**Non si apre il pannello aeroporto.**  
Il negozio logistica HIDC è disponibile solo sulle basi **BLUE**.

**Ho confermato ma non vedo il codice.**  
Apri **Overview** o **Logistica** dello stesso aeroporto. Il codice è il bottone **Codice XXXXXX**.

**In game il comando non fa nulla.**  
Controlla di essere sul server HIDC, di aver scritto `LOG` poi uno spazio poi il codice (senza altri caratteri), e che l’ordine sia ancora visibile sul sito. Se sul sito è già sparito, è già stato ritirato.

**Il codice non viene accettato.**  
Possibili cause: codice sbagliato, ordine già ritirato, oppure **Punti fazione BLUE** insufficienti.

**Ho premuto Completa per sbaglio.**  
L’ordine è chiuso e il codice non è più valido in game. Creane uno nuovo.

**Ho messo container ma volo in elicottero.**  
CH-47F, UH-1H e Mi-8 accettano solo casse. Annulla o modifica l’ordine e metti solo casse, oppure fai ritirare il container da un C-130.

**Questo sistema non è** lo spawn di casse/fanteria dal tasto destro sulla mappa. Quelle unità usano un altro canale. **DLOGISTICS** riguarda solo gli ordini del negozio Logistica con codice `LOG`.

---

## Promemoria operativo

```text
Sito (base BLUE) → Conferma ordine → copia il codice
Server HIDC → chat: LOG <codice>
DLOGISTICS → spawna il carico e scala i punti fazione
Carica e consegna sulla base dell’ordine
```
