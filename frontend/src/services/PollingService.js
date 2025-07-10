class PollingService {
  constructor() {
    this.pollingInterval = null;
    this.intervalTime = 10000; // Poll every 10 seconds
    this.listeners = {
      data: [],
      connect: [],
      disconnect: [],
      error: []
    };
    this.connected = false;
    this.isFirstFetch = true;
  }

  connect() {
    console.log("PollingService: Starting polling service...");
    this.connected = true;
    
    // Notify connection immediately
    setTimeout(() => {
      console.log("PollingService: Triggering connect event");
      this.notifyListeners("connect");
    }, 100);
    
    // Start polling immediately
    this.fetchData();
    
    // Set up interval polling
    this.pollingInterval = setInterval(() => {
      this.fetchData();
    }, this.intervalTime);
  }

  async fetchData() {
    try {
      // Get auth token from localStorage
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No authentication token found");
      }

      // Fetch complete dashboard data which includes everything
      const response = await fetch("/api/dashboard", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Transform data to match expected format
      const transformedData = {
        type: this.isFirstFetch ? "initial_data" : "dashboard_update",
        data: data
      };

      console.log(`PollingService: Dashboard data fetched successfully, type: ${transformedData.type}`);
      console.log("PollingService: Data keys:", Object.keys(data));
      this.notifyListeners("data", transformedData);
      
      // After first fetch, subsequent fetches will be updates
      this.isFirstFetch = false;
      
    } catch (error) {
      console.error("PollingService: Error fetching data:", error);
      this.notifyListeners("error", error);
    }
  }

  disconnect() {
    console.log("PollingService: Stopping polling service...");
    this.connected = false;
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.notifyListeners("disconnect");
  }

  onMessage(callback) {
    this.listeners.data.push(callback);
  }

  onConnect(callback) {
    this.listeners.connect.push(callback);
  }

  onDisconnect(callback) {
    this.listeners.disconnect.push(callback);
  }

  onError(callback) {
    this.listeners.error.push(callback);
  }

  notifyListeners(event, data) {
    console.log(`PollingService: Notifying ${this.listeners[event].length} listeners for event: ${event}`);
    this.listeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`PollingService: Error in ${event} listener:`, error);
      }
    });
  }

  isConnected() {
    return this.connected;
  }

  getReadyState() {
    return this.connected ? 1 : 0; // 1 = OPEN, 0 = CLOSED
  }

  // Add these properties to match WebSocket interface
  get readyState() {
    return this.connected ? 1 : 0;
  }

  get CONNECTING() { return 0; }
  get OPEN() { return 1; }
  get CLOSING() { return 2; }
  get CLOSED() { return 3; }
}

export default PollingService;
