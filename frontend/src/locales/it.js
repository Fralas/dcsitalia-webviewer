export default {
  general: {
    appTitle: 'DCS Frontline',
    appSubtitle: 'Gestione Campagna Dinamica',
    loading: 'Caricamento DCS Warehouse Viewer...',
    errorTitle: 'Errore nel caricamento dei dati',
    retry: 'Riprova',
    connection: {
      online: 'online',
      offline: 'offline',
      connecting: 'connessione...'
    },
    navigation: {
      dashboard: 'Dashboard',
      airports: 'Aeroporti',
      missions: 'Logistica',
      map: 'Mappa',
      admin: 'Admin'
    },
    statusLabels: {
      critical: 'CRITICO',
      high: 'ALTO',
      medium: 'MEDIO',
      ok: 'OK',
      normal: 'NORMALE',
      pending: 'In attesa',
      accepted: 'Accettata',
      expired: 'SCADUTA'
    },
    buttons: {
      accept: 'Accetta',
      complete: 'Completa',
      cancel: 'Annulla',
      createOrder: 'Crea Ordine',
      supplyRequest: 'Richiedi Rifornimento',
      login: 'Accedi',
      logout: 'Logout',
      verify: 'Verifica...'
    },
    auth: {
      signInTitle: 'Accedi',
      signInHint: 'Autenticati per accettare e gestire le missioni',
      discordButton: 'Continua con Discord',
      close: 'Chiudi',
    },
    prompts: {
      confirmComplete: 'Segnare questa missione come completata?',
      confirmCancel: 'Annullare questa missione?',
      confirmClearOrders: 'Sei sicuro di voler cancellare tutti gli ordini?'
    },
    form: {
      yourName: 'Il tuo nome...',
      pilotName: 'Nome pilota...'
    },
    clear: 'Rimuovi',
    unknown: 'Sconosciuto'
  },
  dashboard: {
    title: 'Dashboard Operativa',
    subtitle: 'Sintesi logistica e aggiornamenti in tempo reale',
    status: {
      live: 'Live'
    },
    stats: {
      activeAirports: 'Aeroporti attivi',
      activeZones: 'Zone attive',
      missions: 'Missioni attive',
      pending: 'In attesa'
    },
    announcements: {
      title: 'Annunci operativi',
      subtitle: 'Messaggi e aggiornamenti per tutti i piloti',
      empty: 'Nessun annuncio attivo',
      unknownAuthor: 'Admin',
      form: {
        title: 'Titolo annuncio',
        body: 'Messaggio breve',
        image: 'URL immagine (opzionale)',
        upload: 'Carica immagine',
        publish: 'Pubblica',
        remove: 'Rimuovi'
      }
    },
    acceptedMissions: {
      title: 'Missioni accettate',
      subtitle: 'Piloti assegnati alle missioni',
      empty: 'Nessuna missione accettata',
      logistics: 'LOG',
      combat: 'COMBAT',
      noAssignee: 'Nessun pilota'
    },
    activeTasks: {
      title: 'Task attive',
      subtitle: 'Conteggio task combat in corso',
      sead: 'SEAD',
      dead: 'DEAD',
      cas: 'CAS'
    },
    pipeline: {
      title: 'Pipeline missioni',
      subtitle: 'Top aeroporti per ordini',
      empty: 'Nessun ordine disponibile',
      orders: '{{count}} ordini'
    }
  },
  airportsDirectory: {
    title: 'Aeroporti',
    subtitle: 'Elenco completo con informazioni di base',
    emptyTitle: 'Nessun aeroporto trovato',
    emptySubtitle: 'Nessun dato disponibile',
    activeCount: 'Aeroporti attivi',
    missions: 'missioni in arrivo',
    labels: {
      icao: 'ICAO'
    },
    tags: {
      mainBase: 'Base principale',
      heliport: 'Eliporto',
      airport: 'Aeroporto',
      carrier: 'Carrier'
    }
  },
  airportDetails: {
    subtitle: 'Scheda completa aeroporto',
    back: 'Torna agli aeroporti',
    emptyTitle: 'Aeroporto non trovato',
    emptySubtitle: 'Seleziona un aeroporto dalla lista'
  },
  airportCard: {
    activeOrders: 'ORDINI ATTIVI',
    pdfUnavailable: 'Nessuna chart disponibile per questo aeroporto',
    refuel: 'Rifornimento',
    supplyOrders: 'Rifornimento',
    pendingLabel: 'Attesa',
    acceptedLabel: 'Accettata',
    baseLabel: 'Base Principale',
    elapsed: {
      seconds: '{{count}}s fa',
      minutes: '{{count}}m fa',
      hours: '{{count}}h fa',
      days: '{{count}}g fa'
    },
    remaining: {
      expired: 'SCADUTA',
      seconds: '{{count}}s',
      minutes: '{{count}}m',
      hours: '{{count}}h',
      days: '{{count}}g'
    },
    alerts: {
      selectWeapon: "Seleziona un'arma e inserisci una quantità valida",
      orderSuccess: 'Ordine creato con successo!',
      orderError: "Errore nella creazione dell'ordine: {{message}}",
      enterName: 'Inserisci il tuo nome',
      acceptError: "Errore nell'accettare la missione: {{message}}",
      completeError: "Errore nel completare la missione: {{message}}",
      cancelError: "Errore nell'annullare la missione: {{message}}"
    },
    headers: {
      weapons: 'Armi e Munizioni',
      weapon: 'Arma',
      quantity: 'Qtà',
      status: 'Stato',
      charts: 'Chart',
      type: 'Tipo',
      level: 'Livello',
      historical: 'Andamento Storico (7 giorni)',
      selectWeapon: "-- Seleziona un'arma per vedere il grafico --",
      selectWeaponInfo: "Seleziona un'arma dal menu per visualizzare il grafico",
      dataFrequency: '📊 Dati salvati ogni 4 ore'
    },
    modal: {
      title: 'Richiedi Rifornimento',
      airport: 'Aeroporto',
      selectWeapon: 'Seleziona Arma',
      quantityLabel: 'Quantità da Ordinare',
      suggested: 'Suggerito: {{value}}'
    },
    orderButton: 'Crea Ordine',
    cancelButton: 'Annulla',
    filters: {
      stocks: 'Scorte',
      requested: 'Richieste'
    },
    table: {
      weapon: 'Arma',
      qty: 'Qtà',
      status: 'Stato'
    },
    priority: {
      critical: '🔴 CRITICA',
      high: '🟠 ALTA',
      medium: '🟡 MEDIA'
    },
    recommended: {
      title: 'Consigliato:',
      helicopter: 'Elicottero',
      airplane: 'C-130',
      airdrop: 'Airdrop'
    },
    orders: {
      pilot: 'Pilota:',
      accept: 'Accetta',
      complete: 'Completa',
      cancel: 'Annulla',
      distanceSeparator: '•'
    },
    chart: {
      emptyTitle: "Seleziona un'arma dal menu per visualizzare il grafico",
      emptySubtitle: '📊 Dati salvati ogni 4 ore'
    },
    charts: {
      loading: 'Caricamento chart...',
      empty: 'Nessuna chart disponibile'
    }
  },
  mapView: {
    title: 'Mappa delle Rotte',
    subtitle: 'Visualizzazione geografica delle missioni attive',
    legend: {
      pending: 'Attesa',
      accepted: 'Accettata',
      airport: 'Aeroporto',
      heliport: 'Eliporto',
      carrier: 'Portaerei',
      base: 'Base'
    },
    popup: {
      heliport: 'ELIPORTO',
      airport: 'AEROPORTO',
      carrier: 'PORTAEREI',
      missions: '{{count}} missioni attive'
    },
    sidebar: {
      heading: 'Missioni',
      empty: 'Nessuna missione'
    },
    missionCard: {
      quantity: 'Qtà:',
      clickHint: '👆 Clicca di nuovo per aprire la pagina Missioni'
    }
  },
  missionDispatch: {
    title: 'Gestione Missioni',
    subtitle: 'Missioni di rifornimento attive',
    iso: {
      title: 'Carico ISO',
      container: 'ISO container',
      containerSmall: 'ISO small',
      containerShort: 'ISO',
      containerSmallShort: 'ISO small',
      empty: 'Vuoto',
      emptySummary: 'Vuoto',
      overflow: 'Eccedenza:'
    },
    stats: {
      pending: 'Attesa',
      accepted: 'Accettate',
      critical: 'Critiche'
    },
    filters: {
      all: 'Tutte',
      pending: 'In Attesa',
      accepted: 'Accettate',
      route: 'Route',
      priority: 'Priorità',
      airport: 'Aeroporto',
      allRoutes: 'Tutte le route',
      allPriorities: 'Tutte le priorità'
    },
    emptyTitle: 'Nessuna missione disponibile',
    emptySubtitle: 'Le missioni appariranno qui quando le scorte saranno basse',
    timeAgo: {
      seconds: '{{count}}s fa',
      minutes: '{{count}}m fa',
      hours: '{{count}}h fa',
      days: '{{count}}g fa'
    },
    timeRemaining: {
      expired: 'SCADUTA',
      seconds: '{{count}}s',
      minutes: '{{count}}m',
      hours: '{{count}}h',
      days: '{{count}}g'
    },
    quantities: {
      stock: 'Scorte',
      requested: 'Richieste'
    },
    recommended: {
      label: 'Consigliato:',
      helicopter: 'Elicottero',
      airplane: 'C-130',
      airdrop: 'Airdrop'
    },
    pilot: 'Pilota:',
    accept: 'Accetta',
    complete: 'Completa',
    cancel: 'Annulla',
    ok: 'OK',
    namePlaceholder: 'Il tuo nome...'
  },
  lidc: {
    title: 'Low Intensity Dynamic Campaign',
    subtitle: 'Crea uno squadrone LIDC con deck e codice invito',
    sidebar: {
      visualization: 'Visualizzazione squadrone',
      navigation: 'Navigazione',
      squadronList: 'Lista squadroni',
      squadronManagement: 'Gestione squadrone',
      memberManagement: 'Gestione membri',
      aircraftManagement: 'Gestione velivoli'
    },
    views: {
      overview: 'Visualizzazione squadrone',
      caps: 'Limiti template',
      deck: 'Visualizzazione deck',
      invites: 'Visualizzazione inviti'
    },
    map: {
      title: 'MAPPA TEATRO',
      expandHint: 'Clicca per aprire a schermo intero',
    },
    debug: {
      leaveSquadron: 'Debug: Abbandona squadrone',
      deleteSquadron: 'Debug: Cancella squadrone',
    },
    steps: {
      info: 'Squadron Info',
      specializations: 'Specializzazioni',
      deck: 'Deck',
      review: 'Review / Create'
    },
    wizard: {
      title: 'Creazione guidata squadrone',
      subtitle: 'Procedi step by step. Puoi avanzare solo dopo aver completato i campi richiesti.',
      close: 'Chiudi',
      requiredToContinue: 'Per continuare completa i campi richiesti',
      sections: {
        infoTitle: 'Identita squadrone',
        infoHint: 'Inserisci nome, descrizione, base operativa e logo.',
        specializationsTitle: 'Selezione specializzazioni',
        specializationsHint: 'Scegli {{count}} specializzazioni: i loro limiti si sommano nel budget del deck.',
        deckTitle: 'Composizione deck',
        deckHint: 'Riempi gli slot di ogni categoria restando entro il budget disponibile.',
        reviewTitle: 'Controllo finale',
        reviewHint: 'Verifica i dati prima della creazione dello squadrone.'
      }
    },
    general: {
      loading: 'Caricamento configurazione LIDC...',
      loadingUsers: 'Caricamento utenti...',
      loadingUserState: 'Caricamento stato utente...',
      back: 'Indietro',
      next: 'Avanti',
      cancel: 'Annulla',
      confirm: 'Conferma'
    },
    home: {
      createSquadron: 'Crea nuovo squadrone',
      createSquadronAction: 'Crea squadrone',
      joinSquadron: 'Unisciti allo squadrone',
      mySquadronTitle: 'Il mio squadrone',
      invitesList: 'Lista inviti',
      chooseAction: 'Seleziona una azione',
      chooseActionHint: 'Non sei in uno squadrone: creane uno nuovo o unisciti con un codice invito.'
    },
    link: {
      title: 'Collega account DCS',
      linked: 'Account DCS collegato',
      linkedAs: 'Collegato come {{name}}',
      notLinked: 'Non collegato a DCS',
      codeLabel: 'Il tuo codice',
      codeHint: 'Scrivi questo codice in chat DCS mentre sei connesso al server.',
      reveal: 'Passa il mouse per mostrare il codice',
      expiresAt: 'Scade alle {{time}}',
      error: 'Impossibile avviare il collegamento',
    },
    center: {
      loginTitle: 'Accesso richiesto',
      loginHint: 'Effettua il login Discord per creare uno squadrone o unirti con un codice invito.',
      notInSquadronTitle: 'Non sei in uno squadrone',
      notInSquadronHint: 'Puoi creare un nuovo squadrone o unirti con un codice invito.',
      joinTitle: 'Unisciti allo squadrone',
      joinHint: 'Inserisci il codice invito condiviso dal tuo squadrone.',
      inSquadronTitle: 'Squadrone gia assegnato',
      inSquadronHint: 'Sei gia nel gruppo {{name}}.',
      leaveSquadron: 'Abbandona squadrone',
      deleteSquadron: 'Cancella squadrone',
      deleteOwnerOnlyHint: 'Solo l\'owner puo cancellare lo squadrone.',
      confirmTitle: 'Conferma azione',
      confirmQuestion: 'Sei sicuro di {{action}}?',
      confirmActionLeave: 'abbandonare lo squadrone',
      confirmActionDelete: 'cancellare lo squadrone',
      leaveConfirm: 'Vuoi davvero abbandonare questo squadrone?',
      dismissNotice: 'Chiudi avviso',
      backHome: 'Torna alla selezione'
    },
    auth: {
      loginToCreate: 'Per creare lo squadrone devi essere autenticato via Discord.',
      loginButton: 'Accedi con Discord'
    },
    errors: {
      catalogLoadFailed: 'Impossibile caricare catalogo specializzazioni/unità.',
      infoRequired: 'Nome squadrone e base operativa sono obbligatori.',
      specializationsRequired: 'Seleziona esattamente due specializzazioni.',
      deckEmpty: 'Aggiungi almeno una unità nel deck.',
      deckCapsExceeded: 'Il deck supera uno o più limiti di categoria.',
      deckUpdateFailed: 'Impossibile aggiornare il deck dello squadrone.',
      loginRequired: 'Devi effettuare il login per creare lo squadrone.',
      logoUploadFailed: 'Impossibile elaborare il logo selezionato.',
      createFailed: 'Creazione squadrone non riuscita.',
      userStateFailed: 'Impossibile verificare il tuo stato LIDC.',
      squadronLoadFailed: 'Impossibile caricare i dettagli dello squadrone.',
      squadronsListFailed: 'Impossibile caricare la lista squadroni.',
      joinFailed: 'Impossibile unirsi allo squadrone con questo codice.',
      airframeAssignFailed: 'Impossibile aggiornare l\'assegnazione del velivolo.',
      leaveFailed: 'Impossibile abbandonare lo squadrone.',
      deleteFailed: 'Impossibile cancellare lo squadrone.'
    },
    info: {
      name: 'Nome squadrone',
      description: 'Descrizione',
      base: 'Base operativa',
      basePlaceholder: 'Seleziona base...',
      logo: 'Logo squadrone',
      logoUpload: 'Carica logo'
    },
    specializations: {
      title: 'Specializzazioni',
      noDescription: 'Nessuna descrizione',
      emptySlot: 'Slot vuoto',
      clearSlot: 'Rimuovi specializzazione',
      combinedCaps: 'Budget combinato',
      cardTotal: 'Capacita totale'
    },
    builder: {
      totalBudget: 'Budget deck',
      noBudgetHint: 'Seleziona prima le specializzazioni per sbloccare il budget del deck.',
      addUnit: 'Aggiungi unita',
      removeUnit: 'Rimuovi {{unit}}',
      increase: 'Aggiungi uno',
      decrease: 'Rimuovi uno',
      unitCostEach: '({{cost}} cad.)',
      closePicker: 'Chiudi selezione unita',
      closeUnitList: 'Chiudi',
      searchPlaceholder: 'Cerca unita...',
      noUnitsFound: 'Nessuna unita corrisponde alla ricerca.',
      notEnoughBudget: 'Budget insufficiente in questa categoria.',
      inDeck: 'nel deck x{{count}}',
      editDeck: 'Modifica deck',
      editorTitle: 'Modifica deck squadrone',
      editorHint: 'Cambia la composizione restando nel budget con cui e stato creato lo squadrone.',
      saveDeck: 'Salva deck'
    },
    deck: {
      categories: {
        aircrafts: 'Aircrafts',
        helicopters: 'Helicopters',
        logistics: 'Logistics',
        groundAssets: 'Ground Assets'
      },
      spentLabel: 'Speso:',
      capLabel: 'Limite:',
      capLine: 'Speso {{spent}} / Limite {{cap}}',
      remaining: 'Residuo',
      unitCost: 'Costo: {{cost}}',
      totalUnits: 'Unità totali',
      expandHint: 'Clicca per aprire a schermo intero',
      fullscreenTitle: 'Gestione deck'
    },
    inviteCode: {
      label: 'Codice invito',
      placeholder: 'XXXX-XXXX',
      shareLabel: 'Codice invito squadrone',
      shareHint: 'Condividi questo codice con i piloti che vuoi far entrare nello squadrone.',
      copy: 'Copia',
      copied: 'Copiato',
      reveal: 'Passa il mouse per mostrare il codice',
      hide: 'Passa il mouse per nascondere il codice',
      generatedOnCreate: 'Codice invito',
      yes: 'Generato automaticamente'
    },
    members: {
      listTitle: 'Membri non assegnati',
      empty: 'Nessun membro disponibile nello squadrone.',
      owner: 'Owner',
      admin: 'Admin',
      member: 'Membro',
      expandHint: 'Clicca per aprire a schermo intero',
      fullscreenTitle: 'Gestione membri',
      columns: {
        user: 'Utente',
        aircrafts: 'Aircrafts assegnati',
        helicopters: 'Helicopters assegnati',
        logistics: 'Logistics assegnati',
        aircraftsShort: 'A',
        helicoptersShort: 'H',
        logisticsShort: 'L',
        role: 'Ruolo',
        actions: 'Azioni',
      },
      actions: {
        label: 'Azioni',
        promote: 'Promuovi',
        demote: 'Degrada',
        remove: 'Espelli',
        failed: 'Impossibile aggiornare il membro.',
      },
    },
    squadrons: {
      listEmpty: 'Nessuno squadrone disponibile.',
    },
    airframes: {
      empty: 'Nessun velivolo acquistato nel deck.',
      assignedPilot: 'Pilota assegnato',
      unassigned: 'Non assegnato',
      rowHint: 'Clicca un velivolo per modificare i dati e aprire i log operativi (mock).',
      editorTitle: 'Dettaglio velivolo',
      editorHint: 'Modello, base, board number e status sono in sola lettura (mock). Puoi assegnare solo il pilota.',
      logsTitle: 'Log operativi',
      logsMockBadge: 'MOCK DATA',
      save: 'Salva velivolo',
      columns: {
        model: 'Modello',
        pilot: 'Pilota',
        base: 'Base',
        boardNumber: 'Board Number',
        status: 'Status'
      },
      statusOptions: {
        airborne: 'In aria',
        grounded: 'A terra',
        destroyed: 'Distrutto'
      },
      validation: {
        pilotMustBeMember: 'Il pilota deve essere un membro dello squadrone.'
      }
    },
    review: {
      createButton: 'Crea Squadrone',
      created: 'Squadrone creato con successo',
      assetsTitle: 'Asset selezionati'
    },
    preview: {
      eyebrow: 'Live Preview',
      fallbackName: 'Nuovo Squadrone LIDC',
      fallbackDescription: 'Anteprima della configurazione operativa e del deck.',
      logoPlaceholder: 'Nessun logo',
      templateCaps: 'Budget deck',
      deckSummary: 'Riepilogo deck',
      emptyCategory: 'Nessuna unità'
    },
    admin: {
      openEditor: 'Editor Catalogo',
      title: 'Editor Catalogo LIDC',
      subtitle: 'Modifica specializzazioni e catalogo unità (JSON)',
      invalidJson: 'JSON non valido.',
      saveFailed: 'Salvataggio catalogo non riuscito.',
      save: 'Salva modifiche'
    }
  },
  admin: {
    accessRestricted: 'Accesso riservato agli amministratori',
    passwordPlaceholder: 'Inserisci password',
    sessionExpired: 'Sessione scaduta. Effettua nuovamente il login.',
    invalidPassword: 'Password non valida',
    debugTitle: 'Admin Panel',
    debugSubtitle: 'Gestione configurazioni e debug',
    tabs: {
      debug: 'Debug',
      rules: 'Regole',
      airports: 'Aeroporti'
    },
    buttons: {
      generateOrders: 'Genera Ordini',
      clearOrders: 'Cancella Ordini'
    },
    alerts: {
      generatedOrders: '✅ Generati {{count}} ordini',
      clearedOrders: '✅ Cancellati {{count}} ordini',
      error: '❌ Errore: {{message}}'
    }
  },
  map: {
    missionStatus: {
      pending: 'In attesa',
      accepted: 'Accettata'
    },
    rightPanel: {
      ariaLabel: 'Pannello mappa',
      liveFeed: 'Live Feed',
      openSidebar: 'Apri pannello',
      closeSidebar: 'Chiudi pannello',
      emptyEventsTitle: 'Nessun evento',
      emptyEventsMessage: 'L\'attività apparirà qui man mano che accade.',
      activityUpdate: 'Aggiornamento attività',
      timeAgo: {
        justNow: 'proprio ora',
        seconds: '{{count}}s fa',
        minutes: '{{count}}m fa',
        hours: '{{count}}h fa',
        days: '{{count}}g fa'
      },
      feedTypes: {
        zone: 'Zona',
        logistics: 'Logistica',
        ato: 'ATO',
        convoy: 'Convoy',
        dcsar: 'CSAR',
        user: 'Utente',
        production: 'Produzione',
        spawn: 'Spawn',
        build: 'Build',
        system: 'Sistema'
      },
      ops: {
        ariaLabel: 'Pannello operazioni',
        tabs: {
          mission: 'Missione',
          logistic: 'Logistica',
          production: 'Punti di Produzione'
        },
        fixedWing: 'Aereo',
        rotaryWing: 'Elicottero',
        aircraft: 'Mezzo',
        airport: 'Aeroporto',
        departure: 'Partenza',
        arrival: 'Arrivo',
        radius: 'Raggio in miglia nautiche',
        weight: 'Peso carico in chilogrammi',
        side: 'Fazione',
        sideAll: 'Tutti',
        sideBlue: 'Blue',
        minStock: 'Stock minimo',
        stockLabel: 'Scorte',
        productionPoint: 'Production point',
        dropZone: 'Zona di scarico',
        reset: 'Reimposta filtri',
        noResults: 'Nessun risultato nel raggio',
        zone: 'Zona {{number}}',
        nm: '{{value}} NM',
        neutral: 'Neutrale',
        stock: 'Scorte {{count}}',
        airdropUnit: 'Airdrop unit'
      }
    }
  },
  weaponChart: {
    loading: 'Caricamento dati...',
    noData: 'Nessun dato disponibile per questa arma',
    errorLoading: 'Errore nel caricamento dei dati',
    snapshotInfo: 'I dati vengono salvati ogni 4 ore. Attendi il prossimo snapshot.',
    selectWeapon: "Seleziona un'arma per vedere il grafico",
    stats: {
      current: 'Attuale',
      average: 'Media',
      min: 'Min',
      max: 'Max',
      change: 'Variazione',
      lastDays: 'Ultimi {{days}} giorni'
    },
    dataPoints: '📊 Dati raccolti ogni 4 ore • {{count}} punti dati',
    quantityLabel: 'Quantità: {{value}}'
  },
  atc: {
    title: 'Strip ATC',
    loading: 'Caricamento strippiera...',
    newStrip: 'Nuova strip',
    newStripArrival: 'Strip arrivo',
    newStripDeparture: 'Strip partenza',
    editStrip: 'Modifica',
    deleteStrip: 'Elimina',
    searchPlaceholder: 'Cerca callsign...',
    sortAuto: 'Ordine auto (ENAV)',
    sortManual: 'Ordine manuale',
    toast: { updated: 'Board aggiornata' },
    confirmDelete: 'Eliminare la strip {{callsign}}?',
    roles: { ground: 'GROUND', tower: 'TOWER' },
    otherSector: 'Sola lettura',
    charts: {
      toggle: 'Chart',
      title: 'Chart aeroporto',
      select: 'Seleziona chart',
      loading: 'Caricamento chart...',
      empty: 'Nessuna chart disponibile per questo aeroporto',
      error: 'Errore nel caricamento delle chart',
      close: 'Chiudi pannello chart',
      resize: 'Ridimensiona pannello chart',
    },
    direction: { arr: 'Arrivo', dep: 'Partenza' },
    focus: {
      title: 'Strip ingrandita',
      open: 'Ingrandisci',
      close: 'Chiudi',
      hint: 'Clicca sulle celle per modificare. Esc o clic fuori per chiudere.',
    },
    errors: {
      loginRequired: 'Accedi con Discord per operare sulle strip',
      viewOnly: 'Modalità osservatore: accedi per creare o spostare strip',
      claimToOperate: 'Occupa una postazione GROUND o TOWER per operare',
      roleNotClaimed: 'Devi occupare la postazione GROUND o TOWER',
      roleOccupied: 'Postazione già occupata da un altro controllore',
      mustReleaseFirst: 'Lascia la postazione attuale prima di cambiare ruolo',
      stripNotInSector: 'Strip fuori dal tuo settore operativo',
      onlyGroundCreate: 'Solo GROUND può creare nuove strip',
    },
    coord: {
      title: 'Coordinamenti in attesa',
      titleToc: 'TOC in attesa (Tower)',
      titleAog: 'TOG in attesa (Ground)',
    },
    history: {
      title: 'Storico azioni',
      empty: 'Nessuna azione registrata',
      filterLabel: 'Filtra per ruolo',
      filterAll: 'Tutte',
      filterGround: 'Ground',
      filterTower: 'Tower',
    },
    actions: {
      acceptToc: 'AOC',
      rejectToc: 'Rifiuta',
      acceptAog: 'AOG',
      rejectAog: 'Rifiuta',
      cancelHandoff: 'Annulla handoff',
      dragOrWait: 'Trascina o attendi coordinamento',
    },
    slots: {
      available: 'Postazione libera',
      occupiedBy: 'Occupata da {{name}}',
      yourPosition: 'La tua postazione',
      claim: 'Occupa postazione',
      release: 'Lascia postazione',
      selectPosition: 'Occupa una postazione GROUND o TOWER per operare sulle strip',
    },
    queue: {
      title: 'Coda TOC',
    },
    editor: {
      newTitle: 'Nuova strip progresso volo',
      editTitle: 'Modifica strip',
      save: 'Salva',
      cancel: 'Annulla',
      preview: 'Anteprima strip ENAV',
    },
    fields: {
      airport: 'Aeroporto',
      direction: 'Tipo volo',
      callsign: 'Nominativo',
      flightRule: 'Regola',
      aircraftType: 'Tipo aeromobile',
      eta: 'ETA (casella A)',
      eobt: 'EOBT (casella A)',
      origin: 'Provenienza',
      destination: 'Destinazione',
      stand: 'Stand (casella L)',
      remarks: 'Annotazioni (M)',
      runway: 'Pista',
      sid: 'SID',
      ssr: 'SSR',
      clearance: 'Clearance (K)',
      instructions: 'Istruzioni (L)',
      wakeCategory: 'Cat. scia (L/M/H)',
      tas: 'TAS (nodi)',
      ata: 'ATA (F)',
      pilotEstimate: 'Stimato pilota (G)',
      previousFix: 'Fix precedente (H)',
      ato: 'ATO (H)',
      levelPlanned: 'Livello pianificato (B)',
      level: 'Livello (E)',
      startup: 'Messa in moto (G)',
      clearanceTimes: 'Orari clearance (H)',
      route: 'Rotta (J)',
      standAck: 'Stand comunicato al pilota',
    },
    categories: {
      atz: 'ATZ',
      downwind: 'DOWNWIND',
      ldownwind: 'LDOWNWIND',
      rdownwind: 'RDOWNWIND',
      base: 'BASE',
      lbase: 'LBASE',
      rbase: 'RBASE',
      final: 'FINAL',
      runway: 'PISTA',
      hp: 'HP',
      taxi: 'TAXI',
      stand: 'STAND',
      inactive: 'INATTIVI',
    },
    move: {
      hint: 'Strip selezionata: clicca una fase di destinazione o uno slot tra le strip per riordinare.',
      inkHint: 'Scrittura grafica: tasto destro sulla strip (o tieni premuto su mobile) per attivare lo spostamento, oppure usa il pulsante Sposta.',
      inkArmedHint: 'Spostamento attivo: clicca una fase di destinazione o uno slot tra le strip.',
      arm: 'Sposta',
      disarm: 'Annulla sposta',
      insertStart: 'Inserisci all\'inizio della fila',
      insertEnd: 'Inserisci alla fine della fila',
      insertBefore: 'Inserisci prima di {callsign}',
    },
    entry: {
      ink: 'Scrittura grafica',
      keyboard: 'Tastiera',
      clearInk: 'Cancella scrittura',
      undoInk: 'Annulla tratto',
    },
    runway: {
      qnh: 'QNH',
      wind: 'Vento',
      cloud: 'Cloud',
      notes: 'Notes',
      selectEnd: 'Clic sul numero per selezionare la testata in uso',
      editEnd: 'Doppio clic per modificare il numero',
    },
    bays: {
      gInactive: 'Inattivi',
      gActive: 'Attivi',
      gStand: 'Stand / S-UP',
      gTaxi: 'Rullaggio',
      gHp: 'HP',
      gHandoff: 'Handoff TOC',
      tHandoff: 'Handoff TOG',
      tPending: 'In attesa TOC',
      tActive: 'Attivi TWR',
      tFinal: 'Finale',
      tRunway: 'Pista',
      tAirborne: 'Decollato',
      tLanded: 'Atterrato',
      archive: 'Archivio',
    },
  },
};

