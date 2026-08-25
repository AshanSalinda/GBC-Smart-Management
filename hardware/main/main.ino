#include <WiFi.h>
#include <WiFiManager.h>
#include <ArduinoJson.h>
#include <Ticker.h>
#include "mqtt_client.h" 
#include "secrets.h"

// ==========================================
// CONFIGURATION
// ==========================================
// #define MQTT_URI "from secrets.h"
// #define MQTT_USER "from secrets.h"
// #define MQTT_PASS "from secrets.h"
#define DEVICE_NAME "GBC_ESP32_MAIN"
#define AP_PORTAL_NAME "GBC_wifi_Setup"

// --- THE DEBUG SWITCH ---
// Set to 1 for dev, 0 for production
#define DEBUG_MODE 0

#if DEBUG_MODE
  #define LOG_BEGIN(baud) Serial.begin(baud)
  #define LOG_PRINT(x) Serial.print(x)
  #define LOG_PRINTLN(x) Serial.println(x)
  #define LOG_PRINTF(...) Serial.printf(__VA_ARGS__)
#else
  #define LOG_BEGIN(baud)
  #define LOG_PRINT(x)
  #define LOG_PRINTLN(x)
  #define LOG_PRINTF(...)
#endif
// ------------------------

const char root_ca[] PROGMEM = \
"-----BEGIN CERTIFICATE-----\n" \
"MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw\n" \
"TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh\n" \
"cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4\n" \
"WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu\n" \
"ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY\n" \
"MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc\n" \
"h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+\n" \
"0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U\n" \
"A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW\n" \
"T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH\n" \
"B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC\n" \
"B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv\n" \
"KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn\n" \
"OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn\n" \
"jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw\n" \
"qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI\n" \
"rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV\n" \
"HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq\n" \
"hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL\n" \
"ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ\n" \
"3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK\n" \
"NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5\n" \
"ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur\n" \
"TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC\n" \
"jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc\n" \
"oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq\n" \
"4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA\n" \
"mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d\n" \
"emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=\n" \
"-----END CERTIFICATE-----\n";


typedef void (*AckCallback_t)(int tableId, const char* commandId, bool isTurnedOn);

namespace Cloud {
  bool isConnected();
}
namespace Connection {
  bool isConnected();
}

// ==========================================
// MODULE 1: HARDWARE
// ==========================================
namespace Hardware {
  struct TableState {
    uint8_t gpioPin;
    bool pending;
    bool targetIsOn;
    char commandId[40];
    unsigned long timestamp;
  };

  TableState tables[4];
  AckCallback_t onStateChanged = nullptr;

  const uint8_t NETWORK_INDICATOR_PIN = 2;  // use 27 in production
  bool networkIndicatorState = false;

  void begin(AckCallback_t ackCallback) {
    onStateChanged = ackCallback;

    uint8_t pins[4] = {32, 33, 25, 26};
    for (int i = 0; i < 4; i++) {
      tables[i].gpioPin = pins[i];
      tables[i].pending = false;
      tables[i].targetIsOn = false;
      tables[i].timestamp = 0;
      tables[i].commandId[0] = '\0';
      pinMode(tables[i].gpioPin, OUTPUT);
      digitalWrite(tables[i].gpioPin, LOW);
    }

    pinMode(NETWORK_INDICATOR_PIN, OUTPUT);
    digitalWrite(NETWORK_INDICATOR_PIN, LOW);
  }

  void setImmediate(int id, bool isOn) {
    if (id >= 1 && id <= 4) {
      digitalWrite(tables[id - 1].gpioPin, isOn ? HIGH : LOW);
    }
  }

  void queueState(int id, bool isOn, const char* cmdId) {
    if (id < 1 || id > 4) return;
    int idx = id - 1;
    tables[idx].pending = true;
    tables[idx].targetIsOn = isOn;
    strncpy(tables[idx].commandId, cmdId, sizeof(tables[idx].commandId) - 1);
    tables[idx].commandId[sizeof(tables[idx].commandId) - 1] = '\0'; // Ensure null termination
    tables[idx].timestamp = millis();
  }

  void setNetworkIndicator(bool isOn) {
    networkIndicatorState = isOn;
    digitalWrite(NETWORK_INDICATOR_PIN, isOn ? HIGH : LOW);
  }

  void toggleNetworkIndicator() {
    setNetworkIndicator(!networkIndicatorState);
  }

  void update() {
    unsigned long currentMillis = millis();

    // 1. Process Relay States
    for (int i = 0; i < 4; i++) {
      if (tables[i].pending && (currentMillis - tables[i].timestamp >= 500)) {  // Debounce Delay 500ms
        
        digitalWrite(tables[i].gpioPin, tables[i].targetIsOn ? HIGH : LOW);
        LOG_PRINTF("[HARDWARE] Table %d state switched to %s\n", i + 1, tables[i].targetIsOn ? "ON" : "OFF");
        
        if (onStateChanged) {
          onStateChanged(i + 1, tables[i].commandId, tables[i].targetIsOn);
        }
        
        tables[i].pending = false;
      }
    }

    // 2. Process Connection Indicator
    if (!Connection::isConnected() || !Cloud::isConnected()) {
      if (!networkIndicatorState) setNetworkIndicator(true); // Turn ON if either disconnected
    } else {
      if (networkIndicatorState) setNetworkIndicator(false); // Turn OFF if both connected
    }
  }

  bool isTableOn(int id) {
    if (id >= 1 && id <= 4) {
      return digitalRead(tables[id - 1].gpioPin) == HIGH;
    }
    return false;
  }
}

// ==========================================
// MODULE 2: NETWORK (WiFi)
// ==========================================
namespace Connection {
  unsigned long lastWiFiCheck = 0;
  Ticker wifiTicker;

  bool isConnected() {
    return WiFi.status() == WL_CONNECTED;
  }

  void onPortalOpen(WiFiManager *wfm) {
    LOG_PRINTLN("[WIFI] Entered Setup Portal Mode!");
    wifiTicker.attach(1, Hardware::toggleNetworkIndicator);
  }

  void begin() {
    WiFi.setAutoReconnect(true); 
    
    WiFiManager wm;
    wm.setConnectTimeout(30);
    wm.setConfigPortalTimeout(180);
    wm.setAPCallback(onPortalOpen);
    wm.setWebServerCallback([&wm]() {
      auto redirectToWifi = [&wm]() {
        wm.server->sendHeader("Location", "/wifi", true);
        wm.server->send(302, "text/plain", "");
      };

      wm.server->on("/", redirectToWifi);
      wm.server->on("/info", redirectToWifi);
      wm.server->on("/param", redirectToWifi);
      wm.server->on("/exit", redirectToWifi);
      wm.server->on("/restart", redirectToWifi);
    });

    if (!wm.autoConnect(AP_PORTAL_NAME)) {
      LOG_PRINTLN("[WIFI] Setup portal timed out. Switching to background retries...");
      WiFi.mode(WIFI_STA);  // Turn off the Access Point
      WiFi.begin();   	    // Kickstarts the background scanner
    }
    else {
      LOG_PRINTLN("[WIFI] Connected Successfully.");
    }
    wifiTicker.detach();
  }

  void keepAlive() {
    if (millis() - lastWiFiCheck >= 60000) {  // Wifi Check Interval = 1m
      lastWiFiCheck = millis();
      if (!isConnected()) {
        LOG_PRINTLN("[WIFI] Connection lost. Forcing reconnect...");
        WiFi.reconnect();
      }
    }
  }
}

// ==========================================
// MODULE 3: CLOUD (MQTT)
// ==========================================
namespace Cloud {
  esp_mqtt_client_handle_t client = nullptr;
  bool isMqttConnected = false;

  void publishOnlineStatus();
  void requestSync();
  void acknowledgeSync(const char* commandId);
  void publishHealthStatus(const char* commandId);

  bool isConnected() {
    return isMqttConnected;
  }

  void acknowledgeCommand(int tableId, const char* commandId, bool isTurnedOn) {
    JsonDocument doc;
    doc["commandId"] = commandId;
    doc["tableId"] = tableId;
    doc["lightState"] = isTurnedOn ? "ON" : "OFF";
    doc["executed"] = true;
    
    char payload[128];
    char topic[64];
    serializeJson(doc, payload);
    snprintf(topic, sizeof(topic), "gbc/hardware/table/%d/ack", tableId);
    esp_mqtt_client_publish(client, topic, payload, 0, 1, 0);
  }

  void mqtt_event_handler(void* handler_args, esp_event_base_t base, int32_t event_id, void* event_data) {
    esp_mqtt_event_handle_t event = (esp_mqtt_event_handle_t)event_data;
    
    switch ((esp_mqtt_event_id_t)event_id) {
      case MQTT_EVENT_CONNECTED:
        LOG_PRINTLN("[MQTT] Connected to HiveMQ!");
        isMqttConnected = true;
        esp_mqtt_client_subscribe(client, "gbc/hardware/sync/response", 1);
        esp_mqtt_client_subscribe(client, "gbc/hardware/table/+/set", 1);
        esp_mqtt_client_subscribe(client, "gbc/hardware/health/request", 1);
        publishOnlineStatus();
        requestSync();
        break;

      case MQTT_EVENT_DISCONNECTED:
        LOG_PRINTLN("[MQTT] Disconnected from HiveMQ!");
        isMqttConnected = false;
        break;
        
      case MQTT_EVENT_DATA: {
        JsonDocument doc; 
        if (deserializeJson(doc, event->data, event->data_len)) return;  // Deserialization Error

        const char syncTopic[] = "gbc/hardware/sync/response";
        const int syncTopicLen = sizeof(syncTopic) - 1; // -1 to ignore the null terminator
        
        const char healthTopic[] = "gbc/hardware/health/request";
        const int healthTopicLen = sizeof(healthTopic) - 1;

        char setPrefix[] = "gbc/hardware/table/";
        const int setPrefixLen = sizeof(setPrefix) - 1;

        if (event->topic_len == syncTopicLen && strncmp(event->topic, syncTopic, syncTopicLen) == 0) {
          for (JsonObject table : doc["tables"].as<JsonArray>()) {
            const char* stateStr = table["lightState"];
            bool isOn = (stateStr && strcmp(stateStr, "ON") == 0);
            Hardware::setImmediate(table["tableId"].as<int>(), isOn);
          }
          const char* cmdId = doc["commandId"];
          acknowledgeSync(cmdId ? cmdId : "");
        }
        else if (event->topic_len == healthTopicLen && strncmp(event->topic, healthTopic, healthTopicLen) == 0) {
          const char* cmdId = doc["commandId"];
          publishHealthStatus(cmdId ? cmdId : "");
        }
        else if (event->topic_len > setPrefixLen && strncmp(event->topic, setPrefix, setPrefixLen) == 0) {
          int tId = doc["tableId"].as<int>();
          const char* lState = doc["lightState"];
          const char* cmdId = doc["commandId"];
          
          if (lState && strcmp(lState, "null") != 0 && tId != 0) {
            bool isOn = (strcmp(lState, "ON") == 0);
            Hardware::queueState(tId, isOn, cmdId ? cmdId : "");
          }
        }
        break;
      }
      default: break;
    }
  }

  void begin() {
    JsonDocument lwtDoc;
    lwtDoc["status"] = "OFFLINE";
    lwtDoc["deviceName"] = DEVICE_NAME;
    lwtDoc["mac"] = WiFi.macAddress();
    char lwtPayload[128];
    serializeJson(lwtDoc, lwtPayload);
    
    esp_mqtt_client_config_t mqtt_cfg = {};
    mqtt_cfg.broker.address.uri = MQTT_URI;
    mqtt_cfg.broker.verification.certificate = root_ca;
    mqtt_cfg.credentials.username = MQTT_USER;
    mqtt_cfg.credentials.authentication.password = MQTT_PASS;
    
    static char clientId[32];
    snprintf(clientId, sizeof(clientId), "%s_%s", DEVICE_NAME, WiFi.macAddress().c_str());
    mqtt_cfg.credentials.client_id = clientId;

    mqtt_cfg.session.keepalive = 30;
    mqtt_cfg.session.disable_clean_session = false;

    mqtt_cfg.buffer.size = 2048; 
    mqtt_cfg.session.last_will.topic = "gbc/hardware/status";
    mqtt_cfg.session.last_will.msg = lwtPayload;
    mqtt_cfg.session.last_will.msg_len = strlen(lwtPayload);
    mqtt_cfg.session.last_will.qos = 1;

    client = esp_mqtt_client_init(&mqtt_cfg);
    esp_mqtt_client_register_event(client, MQTT_EVENT_ANY, mqtt_event_handler, NULL);
    esp_mqtt_client_start(client);
  }

  void publishOnlineStatus() {
    JsonDocument doc;
    doc["status"] = "ONLINE";
    doc["deviceName"] = DEVICE_NAME;
    doc["mac"] = WiFi.macAddress();
    char payload[128];
    serializeJson(doc, payload);
    esp_mqtt_client_publish(client, "gbc/hardware/status", payload, 0, 1, 0);
  }

  void requestSync() {
    JsonDocument doc;
    doc["macAddress"] = WiFi.macAddress();
    char payload[128];
    serializeJson(doc, payload);
    esp_mqtt_client_publish(client, "gbc/hardware/sync/request", payload, 0, 1, 0);
  }

  void acknowledgeSync(const char* commandId) {
    JsonDocument doc;
    doc["commandId"] = commandId;
    doc["executed"] = true;
    char payload[128];
    serializeJson(doc, payload);
    esp_mqtt_client_publish(client, "gbc/hardware/sync/ack", payload, 0, 1, 0);
  }

  void publishHealthStatus(const char* commandId) {
    JsonDocument doc;
    doc["commandId"] = commandId;
    doc["deviceName"] = DEVICE_NAME;
    doc["mac"] = WiFi.macAddress();
    doc["uptime"] = millis();
    doc["freeHeap"] = ESP.getFreeHeap();
    doc["heapSize"] = ESP.getHeapSize();
    doc["temperature"] = temperatureRead();
    doc["ssid"] = WiFi.SSID();
    doc["rssi"] = WiFi.RSSI();
    doc["ipAddress"] = WiFi.localIP().toString();

    JsonObject tablesState = doc["tables"].to<JsonObject>();
    for (int i = 1; i <= 4; i++) {
      tablesState[String(i)] = Hardware::isTableOn(i) ? "ON" : "OFF";
    }

    char payload[512];
    serializeJson(doc, payload);
    esp_mqtt_client_publish(client, "gbc/hardware/health/response", payload, 0, 1, 0);
  }
}

// ==========================================
// MAIN EXECUTION
// ==========================================
void setup() {
  LOG_BEGIN(115200);
  Hardware::begin(Cloud::acknowledgeCommand);
  Connection::begin();
  Cloud::begin();
}

void loop() {
  Hardware::update();
  Connection::keepAlive();

  // Yields the CPU to background tasks and lowers heat
  delay(100);
}