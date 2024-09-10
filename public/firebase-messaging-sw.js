importScripts("https://www.gstatic.com/firebasejs/8.2.0/firebase-app.js");
importScripts("https://www.gstatic.com/firebasejs/8.2.0/firebase-messaging.js");

const firebaseConfig = {
  apiKey: "AIzaSyDLai5Nmxp0el8BoQFpDF3e5WIcTSrZfrU",
  authDomain: "ontology-41607.firebaseapp.com",
  projectId: "ontology-41607",
  storageBucket: "ontology-41607.appspot.com",
  messagingSenderId: "163479774214",
  appId: "1:163479774214:web:f6805c87b6d4676f32cf87",
  measurementId: "G-R1G6CLG68D",
};

firebase.initializeApp(firebaseConfig);

// Retrieve firebase messaging
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("Received background message ", payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    data: {
      click_action: "https://1ontology.com",
      ...payload.data,
    },
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const urlToOpen = event.notification.data.click_action;
  event.waitUntil(
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then(function (clientList) {
        let matchingClient = null;
        console.log(clientList, "clientList");

        // Check if the specific tab is already open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes(urlToOpen)) {
            matchingClient = client;
            break;
          }
        }

        // Focus the matching client if found
        if (matchingClient) {
          return matchingClient.focus();
        } else {
          // If the URL is not open, open it in a new tab
          if (clients.openWindow) {
            return clients.openWindow(urlToOpen);
          }
        }
      })
      .then((client) => {
        if (client) {
          client.postMessage({
            type: "NOTIFICATION_CLICKED",
            url: urlToOpen,
            ...event.notification.data,
          });
        }
      })
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "FOCUS_TAB") {
    const urlToFocus = event.data.url;
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clientList) => {
        let matchingClient = null;

        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes(urlToFocus)) {
            matchingClient = client;
            break;
          }
        }

        if (matchingClient) {
          matchingClient.focus();
        } else {
          if (clients.openWindow) {
            clients.openWindow(urlToFocus);
          }
        }
      });
  }
});
