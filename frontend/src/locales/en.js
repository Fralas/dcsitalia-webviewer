export default {
  general: {
    appTitle: 'DCS Frontline',
    appSubtitle: 'Dynamic Campaign Management',
    loading: 'Loading DCS Warehouse Viewer...',
    errorTitle: 'Error Loading Data',
    retry: 'Retry',
    connection: {
      online: 'online',
      offline: 'offline',
      connecting: 'connecting...'
    },
    navigation: {
      dashboard: 'Dashboard',
      airports: 'Airports',
      missions: 'Logistics',
      map: 'Map',
      admin: 'Admin'
    },
    statusLabels: {
      critical: 'CRITICAL',
      high: 'HIGH',
      medium: 'MEDIUM',
      ok: 'OK',
      normal: 'NORMAL',
      pending: 'Pending',
      accepted: 'Accepted',
      expired: 'EXPIRED'
    },
    buttons: {
      accept: 'Accept',
      complete: 'Complete',
      cancel: 'Cancel',
      createOrder: 'Create Order',
      supplyRequest: 'Supply Request',
      login: 'Login',
      logout: 'Logout',
      verify: 'Verifying...'
    },
    prompts: {
      confirmComplete: 'Mark this mission as completed?',
      confirmCancel: 'Cancel this mission?',
      confirmClearOrders: 'Are you sure you want to delete all orders?'
    },
    form: {
      yourName: 'Your name...',
      pilotName: 'Pilot name...'
    },
    clear: 'Clear',
    unknown: 'Unknown'
  },
  dashboard: {
    title: 'Operations Dashboard',
    subtitle: 'Logistics summary and live updates',
    status: {
      live: 'Live'
    },
    stats: {
      activeAirports: 'Active airports',
      activeZones: 'Active zones',
      missions: 'Active missions',
      pending: 'Pending'
    },
    announcements: {
      title: 'Operations announcements',
      subtitle: 'Updates shared with all pilots',
      empty: 'No announcements yet',
      unknownAuthor: 'Admin',
      form: {
        title: 'Announcement title',
        body: 'Short message',
        image: 'Image URL (optional)',
        upload: 'Upload image',
        publish: 'Publish',
        remove: 'Remove'
      }
    },
    acceptedMissions: {
      title: 'Accepted missions',
      subtitle: 'Pilots assigned to missions',
      empty: 'No accepted missions',
      logistics: 'LOG',
      combat: 'COMBAT',
      noAssignee: 'No pilot'
    },
    activeTasks: {
      title: 'Active tasks',
      subtitle: 'Combat task counters',
      sead: 'SEAD',
      dead: 'DEAD',
      cas: 'CAS'
    },
    pipeline: {
      title: 'Mission pipeline',
      subtitle: 'Top airports by orders',
      empty: 'No orders available',
      orders: '{{count}} orders'
    }
  },
  airportsDirectory: {
    title: 'Airports',
    subtitle: 'Full list with basic information',
    emptyTitle: 'No airports found',
    emptySubtitle: 'No data available',
    activeCount: 'Active airports',
    missions: 'incoming missions',
    labels: {
      icao: 'ICAO'
    },
    tags: {
      mainBase: 'Main base',
      heliport: 'Heliport',
      airport: 'Airport',
      carrier: 'Carrier'
    }
  },
  airportDetails: {
    subtitle: 'Full airport details',
    back: 'Back to airports',
    emptyTitle: 'Airport not found',
    emptySubtitle: 'Select an airport from the list'
  },
  airportCard: {
    activeOrders: 'ACTIVE ORDERS',
    pdfUnavailable: 'No chart available for this airport',
    refuel: 'Refuel',
    supplyOrders: 'Supply',
    pendingLabel: 'Pending',
    acceptedLabel: 'Accepted',
    baseLabel: 'Main Base',
    elapsed: {
      seconds: '{{count}}s ago',
      minutes: '{{count}}m ago',
      hours: '{{count}}h ago',
      days: '{{count}}d ago'
    },
    remaining: {
      expired: 'EXPIRED',
      seconds: '{{count}}s',
      minutes: '{{count}}m',
      hours: '{{count}}h',
      days: '{{count}}d'
    },
    alerts: {
      selectWeapon: 'Select a weapon and enter a valid quantity',
      orderSuccess: 'Order created successfully!',
      orderError: 'Error creating order: {{message}}',
      enterName: 'Enter your name',
      acceptError: "Error accepting mission: {{message}}",
      completeError: "Error completing mission: {{message}}",
      cancelError: "Error cancelling mission: {{message}}"
    },
    headers: {
      weapons: 'Weapons & Munitions',
      weapon: 'Weapon',
      quantity: 'Qty',
      status: 'Status',
      charts: 'Charts',
      type: 'Type',
      level: 'Level',
      historical: 'Historical Trend (7 days)',
      selectWeapon: "-- Select a weapon to view the chart --",
      selectWeaponInfo: 'Select a weapon from the menu to view the chart',
      dataFrequency: '📊 Data saved every 4 hours'
    },
    modal: {
      title: 'Request Supply',
      airport: 'Airport',
      selectWeapon: 'Select Weapon',
      quantityLabel: 'Quantity to Order',
      suggested: 'Suggested: {{value}}'
    },
    orderButton: 'Create Order',
    cancelButton: 'Cancel',
    filters: {
      stocks: 'Stock',
      requested: 'Requested'
    },
    table: {
      weapon: 'Weapon',
      qty: 'Qty',
      status: 'Status'
    },
    priority: {
      critical: '🔴 CRITICAL',
      high: '🟠 HIGH',
      medium: '🟡 MEDIUM'
    },
    recommended: {
      title: 'Recommended:',
      helicopter: 'Helicopter',
      airplane: 'C-130',
      airdrop: 'Airdrop'
    },
    orders: {
      pilot: 'Pilot:',
      accept: 'Accept',
      complete: 'Complete',
      cancel: 'Cancel',
      distanceSeparator: '•'
    },
    chart: {
      emptyTitle: 'Select a weapon from the menu to view the chart',
      emptySubtitle: '📊 Data saved every 4 hours'
    },
    charts: {
      loading: 'Loading charts...',
      empty: 'No charts available'
    }
  },
  mapView: {
    title: 'Route Map',
    subtitle: 'Geographic view of active missions',
    legend: {
      pending: 'Pending',
      accepted: 'Accepted',
      airport: 'Airport',
      heliport: 'Heliport',
      carrier: 'Carrier',
      base: 'Base'
    },
    popup: {
      heliport: 'HELIPORT',
      airport: 'AIRPORT',
      carrier: 'CARRIER',
      missions: '{{count}} active missions'
    },
    sidebar: {
      heading: 'Missions',
      empty: 'No missions'
    },
    missionCard: {
      quantity: 'Qty:',
      clickHint: '👆 Click again to open the Missions page'
    }
  },
  missionDispatch: {
    title: 'Mission Management',
    subtitle: 'Active resupply missions',
    iso: {
      title: 'ISO Load',
      container: 'ISO container',
      containerSmall: 'ISO small',
      containerShort: 'ISO',
      containerSmallShort: 'ISO small',
      empty: 'Empty',
      emptySummary: 'Empty',
      overflow: 'Overflow:'
    },
    stats: {
      pending: 'Pending',
      accepted: 'Accepted',
      critical: 'Critical'
    },
    filters: {
      all: 'All',
      pending: 'Pending',
      accepted: 'Accepted',
      route: 'Route',
      priority: 'Priority',
      airport: 'Airport',
      allRoutes: 'All routes',
      allPriorities: 'All priorities'
    },
    emptyTitle: 'No missions available',
    emptySubtitle: 'Missions will appear here when stock levels are low',
    timeAgo: {
      seconds: '{{count}}s ago',
      minutes: '{{count}}m ago',
      hours: '{{count}}h ago',
      days: '{{count}}d ago'
    },
    timeRemaining: {
      expired: 'EXPIRED',
      seconds: '{{count}}s',
      minutes: '{{count}}m',
      hours: '{{count}}h',
      days: '{{count}}d'
    },
    quantities: {
      stock: 'Stock',
      requested: 'Requested'
    },
    recommended: {
      label: 'Recommended:',
      helicopter: 'Helicopter',
      airplane: 'C-130',
      airdrop: 'Airdrop'
    },
    pilot: 'Pilot:',
    accept: 'Accept',
    complete: 'Complete',
    cancel: 'Cancel',
    ok: 'OK',
    namePlaceholder: 'Your name...'
  },
  lidc: {
    title: 'Low Intensity Dynamic Campaign',
    subtitle: 'Create a LIDC squadron with deck and invites',
    sidebar: {
      visualization: 'Squadron visualization',
      navigation: 'Navigation',
      squadronList: 'Squadron list',
      squadronManagement: 'Squadron management',
      memberManagement: 'Member management',
      aircraftManagement: 'Aircraft management'
    },
    views: {
      overview: 'Squadron visualization',
      caps: 'Template caps',
      deck: 'Deck visualization',
      invites: 'Invites visualization'
    },
    steps: {
      info: 'Squadron Info',
      template: 'Template',
      deck: 'Deck',
      invites: 'Invites',
      review: 'Review / Create'
    },
    wizard: {
      title: 'Guided squadron creation',
      subtitle: 'Proceed step by step. You can move forward only after required fields are completed.',
      close: 'Close',
      requiredToContinue: 'Complete required fields to continue',
      sections: {
        infoTitle: 'Squadron identity',
        infoHint: 'Provide name, description, operating base, and logo.',
        templateTitle: 'Template selection',
        templateHint: 'Choose the starting group. It defines category budget caps.',
        deckTitle: 'Deck composition',
        deckHint: 'Add units by category while staying under the selected template caps.',
        invitesTitle: 'Team invites',
        invitesHint: 'Select pilots to invite. Invites will be created with pending status.',
        reviewTitle: 'Final review',
        reviewHint: 'Check all details before creating the squadron.'
      }
    },
    general: {
      loading: 'Loading LIDC configuration...',
      loadingUsers: 'Loading users...',
      loadingUserState: 'Loading user state...',
      back: 'Back',
      next: 'Next',
      cancel: 'Cancel',
      confirm: 'Confirm'
    },
    home: {
      createSquadron: 'Create new squadron',
      invitesList: 'Invites list',
      chooseAction: 'Choose an action',
      chooseActionHint: 'You are not in a squadron: create one or check pending invites.'
    },
    center: {
      loginTitle: 'Login required',
      loginHint: 'Sign in with Discord to create a squadron or review your invites.',
      notInSquadronTitle: 'You are not in a squadron',
      notInSquadronHint: 'Create a new squadron or open your pending invite list.',
      inviteListTitle: 'Invite list',
      inviteListHint: 'These are your current LIDC invites with pending status.',
      inSquadronTitle: 'Squadron already assigned',
      inSquadronHint: 'You are already in group {{name}}.',
      leaveSquadron: 'Leave squadron',
      deleteSquadron: 'Delete squadron',
      deleteOwnerOnlyHint: 'Only the owner can delete this squadron.',
      confirmTitle: 'Confirm action',
      confirmQuestion: 'Are you sure you want to {{action}}?',
      confirmActionLeave: 'leave the squadron',
      confirmActionDelete: 'delete the squadron',
      leaveConfirm: 'Do you really want to leave this squadron?',
      dismissNotice: 'Dismiss notice',
      backHome: 'Back to selection'
    },
    auth: {
      loginToCreate: 'You must authenticate via Discord to create a squadron.',
      loginButton: 'Login with Discord'
    },
    errors: {
      catalogLoadFailed: 'Failed to load templates/units catalog.',
      infoRequired: 'Squadron name and operating base are required.',
      templateRequired: 'Select a start template.',
      deckEmpty: 'Add at least one unit to the deck.',
      deckCapsExceeded: 'Deck exceeds one or more category caps.',
      loginRequired: 'You must login before creating a squadron.',
      createFailed: 'Failed to create squadron.',
      userStateFailed: 'Failed to verify your LIDC state.',
      squadronLoadFailed: 'Failed to load squadron details.',
      airframeAssignFailed: 'Failed to update airframe assignment.',
      leaveFailed: 'Failed to leave squadron.',
      deleteFailed: 'Failed to delete squadron.'
    },
    info: {
      name: 'Squadron name',
      description: 'Description',
      base: 'Operating base',
      basePlaceholder: 'Select base...',
      logo: 'Squadron logo',
      logoUpload: 'Upload logo'
    },
    template: {
      title: 'Template',
      noDescription: 'No description',
      recommended: 'recommended',
      totalCap: 'Total capacity'
    },
    deck: {
      categories: {
        aircrafts: 'Aircrafts',
        helicopters: 'Helicopters',
        logistics: 'Logistics',
        groundAssets: 'Ground Assets'
      },
      spentLabel: 'Spent:',
      capLabel: 'Cap:',
      capLine: 'Spent {{spent}} / Cap {{cap}}',
      remaining: 'Remaining',
      unitCost: 'Cost: {{cost}}',
      totalUnits: 'Total units'
    },
    invites: {
      title: 'Invites',
      empty: 'No users available in login history.',
      receivedEmpty: 'You have no pending invites.',
      searchLabel: 'Search user',
      searchPlaceholder: 'Search by name or username...',
      searchEmpty: 'No users found for this filter.',
      you: 'You',
      pending: 'Pending',
      add: 'Invite'
    },
    members: {
      empty: 'No squadron members available.',
      owner: 'Owner',
      member: 'Member'
    },
    airframes: {
      empty: 'No purchased airframes found in this deck.',
      assignedPilot: 'Assigned pilot',
      unassigned: 'Unassigned',
      rowHint: 'Click a row to edit details and open movement/takeoff logs (mock for now).',
      editorTitle: 'Airframe details',
      editorHint: 'Model, base, board number, and status are read-only (mock). Only pilot assignment is editable.',
      logsTitle: 'Operational logs',
      logsMockBadge: 'MOCK DATA',
      save: 'Save airframe',
      columns: {
        model: 'Model',
        pilot: 'Pilot',
        base: 'Base',
        boardNumber: 'Board Number',
        status: 'Status'
      },
      statusOptions: {
        airborne: 'In air',
        grounded: 'On ground',
        destroyed: 'Destroyed'
      },
      validation: {
        pilotMustBeMember: 'Pilot must be a squadron member.'
      }
    },
    review: {
      createButton: 'Create Squadron',
      created: 'Squadron created successfully',
      assetsTitle: 'Selected assets'
    },
    preview: {
      eyebrow: 'Live Preview',
      fallbackName: 'New LIDC Squadron',
      fallbackDescription: 'Preview of operational configuration and deck.',
      logoPlaceholder: 'No logo',
      templateCaps: 'Template caps',
      invites: 'Pending invites',
      noInvites: 'No invites selected',
      deckSummary: 'Deck summary',
      emptyCategory: 'No units'
    },
    admin: {
      openEditor: 'Template Editor',
      title: 'LIDC Template Editor',
      subtitle: 'Edit templates and unit catalog (JSON)',
      invalidJson: 'Invalid JSON.',
      saveFailed: 'Failed to save templates.',
      save: 'Save changes'
    }
  },
  admin: {
    accessRestricted: 'Access reserved for administrators',
    passwordPlaceholder: 'Enter password',
    sessionExpired: 'Session expired. Please login again.',
    invalidPassword: 'Invalid password',
    debugTitle: 'Admin Panel',
    debugSubtitle: 'Configuration and debug management',
    tabs: {
      debug: 'Debug',
      rules: 'Rules',
      airports: 'Airports'
    },
    buttons: {
      generateOrders: 'Generate Orders',
      clearOrders: 'Clear Orders'
    },
    alerts: {
      generatedOrders: '✅ Generated {{count}} orders',
      clearedOrders: '✅ Deleted {{count}} orders',
      error: '❌ Error: {{message}}'
    }
  },
  map: {
    missionStatus: {
      pending: 'Pending',
      accepted: 'Accepted'
    }
  },
  weaponChart: {
    loading: 'Loading data...',
    noData: 'No data available for this weapon',
    errorLoading: 'Error loading data',
    snapshotInfo: 'Data is saved every 4 hours. Please wait for the next snapshot.',
    selectWeapon: 'Select a weapon to view the chart',
    stats: {
      current: 'Current',
      average: 'Average',
      min: 'Min',
      max: 'Max',
      change: 'Change',
      lastDays: 'Last {{days}} days'
    },
    dataPoints: '📊 Data collected every 4 hours • {{count}} data points',
    quantityLabel: 'Quantity: {{value}}'
  },
  atc: {
    title: 'ATC Strips',
    loading: 'Loading strip board...',
    newStrip: 'New strip',
    editStrip: 'Edit',
    deleteStrip: 'Delete',
    searchPlaceholder: 'Search callsign...',
    sortAuto: 'Auto sort (ENAV)',
    sortManual: 'Manual sort',
    toast: { updated: 'Board updated' },
    confirmDelete: 'Delete strip {{callsign}}?',
    roles: { ground: 'GROUND', tower: 'TOWER' },
    otherSector: 'Read only',
    charts: {
      toggle: 'Charts',
      title: 'Airport charts',
      select: 'Select chart',
      loading: 'Loading charts...',
      empty: 'No charts available for this airport',
      error: 'Failed to load charts',
      close: 'Close charts panel',
      resize: 'Resize charts panel',
    },
    direction: { arr: 'Arrival', dep: 'Departure' },
    errors: {
      loginRequired: 'Sign in with Discord to control strips',
      viewOnly: 'Observer mode: sign in to create or move strips',
      claimToOperate: 'Claim a GROUND or TOWER position to operate',
      roleNotClaimed: 'You must claim the GROUND or TOWER position',
      roleOccupied: 'Position already claimed by another controller',
      mustReleaseFirst: 'Release your current position before switching role',
      stripNotInSector: 'Strip is outside your operational sector',
      onlyGroundCreate: 'Only GROUND can create new strips',
    },
    coord: { title: 'Pending coordination' },
    history: {
      title: 'Action history',
      empty: 'No actions yet',
      filterLabel: 'Filter by role',
      filterAll: 'All',
      filterGround: 'Ground',
      filterTower: 'Tower',
    },
    actions: {
      acceptToc: 'AOC',
      rejectToc: 'Reject',
      cancelHandoff: 'Cancel handoff',
      dragOrWait: 'Drag or wait for coordination',
    },
    slots: {
      available: 'Position available',
      occupiedBy: 'Occupied by {{name}}',
      yourPosition: 'Your position',
      claim: 'Claim position',
      release: 'Release position',
      selectPosition: 'Claim a GROUND or TOWER position to operate strips',
    },
    queue: {
      title: 'TOC queue',
    },
    editor: {
      newTitle: 'New flight progress strip',
      editTitle: 'Edit strip',
      save: 'Save',
      cancel: 'Cancel',
      preview: 'ENAV strip preview',
    },
    fields: {
      airport: 'Airport',
      direction: 'Flight type',
      callsign: 'Callsign',
      flightRule: 'Rule',
      aircraftType: 'Aircraft type',
      eta: 'ETA (field A)',
      eobt: 'EOBT (field A)',
      origin: 'Origin',
      destination: 'Destination',
      stand: 'Stand (field L)',
      remarks: 'Remarks (M)',
      runway: 'Runway',
      sid: 'SID',
      ssr: 'SSR',
      clearance: 'Clearance (K)',
      instructions: 'Instructions (L)',
      wakeCategory: 'Wake cat. (L/M/H)',
      tas: 'TAS (knots)',
      ata: 'ATA (F)',
      pilotEstimate: 'Pilot estimate (G)',
      previousFix: 'Previous fix (H)',
      ato: 'ATO (H)',
      levelPlanned: 'Planned level (B)',
      level: 'Level (E)',
      startup: 'Start-up (G)',
      clearanceTimes: 'Clearance times (H)',
      route: 'Route (J)',
      standAck: 'Stand acknowledged to pilot',
    },
    bays: {
      gInactive: 'Inactive',
      gActive: 'Active',
      gStand: 'Stand / S-UP',
      gTaxi: 'Taxi',
      gHp: 'HP',
      gHandoff: 'Handoff TOC',
      tPending: 'Pending TOC',
      tActive: 'TWR Active',
      tFinal: 'Final',
      tRunway: 'Runway',
      tAirborne: 'Airborne',
      tLanded: 'Landed',
      archive: 'Archive',
    },
  },
};

