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
    subtitle: 'Crea uno squadrone LIDC con deck e inviti',
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
    steps: {
      info: 'Squadron Info',
      template: 'Template',
      deck: 'Deck',
      invites: 'Inviti',
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
        templateTitle: 'Selezione template',
        templateHint: 'Scegli il gruppo iniziale: definisce i limiti di costo per categoria.',
        deckTitle: 'Composizione deck',
        deckHint: 'Aggiungi unita per categoria rispettando il limite del template scelto.',
        invitesTitle: 'Inviti squadra',
        invitesHint: 'Seleziona i piloti da invitare. Gli inviti verranno creati in stato pending.',
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
      cancel: 'Annulla'
    },
    home: {
      createSquadron: 'Crea nuovo squadrone',
      invitesList: 'Lista inviti',
      chooseAction: 'Seleziona una azione',
      chooseActionHint: 'Non sei in uno squadrone: scegli se crearne uno nuovo o controllare gli inviti.'
    },
    center: {
      loginTitle: 'Accesso richiesto',
      loginHint: 'Effettua il login Discord per poter creare uno squadrone o vedere i tuoi inviti.',
      notInSquadronTitle: 'Non sei in uno squadrone',
      notInSquadronHint: 'Puoi creare un nuovo squadrone o aprire la lista inviti ricevuti.',
      inviteListTitle: 'Lista inviti',
      inviteListHint: 'Questi sono gli inviti LIDC attualmente in stato pending.',
      inSquadronTitle: 'Squadrone gia assegnato',
      inSquadronHint: 'Sei gia nel gruppo {{name}}.',
      dismissNotice: 'Chiudi avviso',
      backHome: 'Torna alla selezione'
    },
    auth: {
      loginToCreate: 'Per creare lo squadrone devi essere autenticato via Discord.',
      loginButton: 'Accedi con Discord'
    },
    errors: {
      catalogLoadFailed: 'Impossibile caricare catalogo template/unità.',
      infoRequired: 'Nome squadrone e base operativa sono obbligatori.',
      templateRequired: 'Seleziona un template di partenza.',
      deckEmpty: 'Aggiungi almeno una unità nel deck.',
      deckCapsExceeded: 'Il deck supera uno o più limiti di categoria.',
      loginRequired: 'Devi effettuare il login per creare lo squadrone.',
      createFailed: 'Creazione squadrone non riuscita.',
      userStateFailed: 'Impossibile verificare il tuo stato LIDC.',
      squadronLoadFailed: 'Impossibile caricare i dettagli dello squadrone.',
      airframeAssignFailed: 'Impossibile aggiornare l\'assegnazione del velivolo.'
    },
    info: {
      name: 'Nome squadrone',
      description: 'Descrizione',
      base: 'Base operativa',
      basePlaceholder: 'Seleziona base...',
      logo: 'Logo squadrone',
      logoUpload: 'Carica logo'
    },
    template: {
      title: 'Template',
      noDescription: 'Nessuna descrizione',
      recommended: 'consigliato',
      totalCap: 'Capacita totale'
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
      totalUnits: 'Unità totali'
    },
    invites: {
      title: 'Inviti',
      empty: 'Nessun utente disponibile nello storico login.',
      receivedEmpty: 'Non hai inviti in attesa.',
      searchLabel: 'Cerca utente',
      searchPlaceholder: 'Cerca per nome o username...',
      searchEmpty: 'Nessun utente trovato con questo filtro.',
      you: 'Tu',
      pending: 'Pending',
      add: 'Invita'
    },
    members: {
      empty: 'Nessun membro disponibile nello squadrone.',
      owner: 'Owner',
      member: 'Membro'
    },
    airframes: {
      empty: 'Nessun velivolo acquistato nel deck.',
      assignedPilot: 'Pilota assegnato',
      unassigned: 'Non assegnato'
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
      templateCaps: 'Limiti template',
      invites: 'Inviti pending',
      noInvites: 'Nessun invito selezionato',
      deckSummary: 'Riepilogo deck',
      emptyCategory: 'Nessuna unità'
    },
    admin: {
      openEditor: 'Template Editor',
      title: 'Editor Template LIDC',
      subtitle: 'Modifica templates e catalogo unità (JSON)',
      invalidJson: 'JSON non valido.',
      saveFailed: 'Salvataggio template non riuscito.',
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
  }
};

