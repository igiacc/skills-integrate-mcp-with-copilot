document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const loginForm = document.getElementById("login-form");
  const logoutButton = document.getElementById("logout-button");
  const authStatus = document.getElementById("auth-status");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const studentEmailInput = document.getElementById("email");

  let authToken = localStorage.getItem("authToken");
  let currentUser = null;

  function setMessage(text, type = "info") {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");
    if (type !== "info") {
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    }
  }

  function getAuthHeaders() {
    return authToken ? { Authorization: `Bearer ${authToken}` } : {};
  }

  function saveToken(token) {
    authToken = token;
    localStorage.setItem("authToken", token);
  }

  function clearToken() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem("authToken");
    updateAuthUI();
  }

  function updateAuthUI() {
    if (currentUser) {
      authStatus.textContent = `Logged in as ${currentUser.username} (${currentUser.role})`;
      loginForm.classList.add("hidden");
      logoutButton.classList.remove("hidden");
      if (currentUser.role === "student") {
        studentEmailInput.value = currentUser.username;
        studentEmailInput.disabled = true;
      } else {
        studentEmailInput.value = "";
        studentEmailInput.disabled = false;
      }
    } else {
      authStatus.textContent = "Not logged in. Please sign in to manage activities.";
      loginForm.classList.remove("hidden");
      logoutButton.classList.add("hidden");
      studentEmailInput.disabled = false;
      studentEmailInput.value = "";
    }

    if (!authToken) {
      signupForm.querySelector("button[type=submit]").disabled = true;
    } else {
      signupForm.querySelector("button[type=submit]").disabled = false;
    }

    fetchActivities();
  }

  async function fetchCurrentUser() {
    if (!authToken) {
      currentUser = null;
      updateAuthUI();
      return;
    }

    try {
      const response = await fetch("/auth/me", {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        clearToken();
        return;
      }

      const user = await response.json();
      currentUser = user;
      updateAuthUI();
    } catch (error) {
      console.error("Error loading user:", error);
      clearToken();
    }
  }

  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;
        const participantsHtml = details.participants.length > 0
          ? `<div class="participants-section"><h5>Participants:</h5><ul class="participants-list">${details.participants.map((email) => {
              const canRemove = currentUser && (currentUser.role === "teacher" || currentUser.username === email);
              return `<li><span class="participant-email">${email}</span>${canRemove ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>` : ""}</li>`;
            }).join("")}</ul></div>`
          : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHtml}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  async function handleUnregister(event) {
    if (!currentUser) {
      setMessage("Please log in as a teacher to remove participants.", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        setMessage(result.message, "success");
        fetchActivities();
      } else {
        setMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      setMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser) {
      setMessage("Please log in before signing up.", "error");
      return;
    }

    const email = studentEmailInput.value;
    const activity = activitySelect.value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        setMessage(result.message, "success");
        signupForm.reset();
        if (currentUser && currentUser.role === "student") {
          studentEmailInput.value = currentUser.username;
        }
        fetchActivities();
      } else {
        setMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      setMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (response.ok) {
        saveToken(result.access_token);
        currentUser = { username: result.username, role: result.role };
        updateAuthUI();
        setMessage("Logged in successfully.", "success");
      } else {
        setMessage(result.detail || "Login failed.", "error");
      }
    } catch (error) {
      setMessage("Login request failed. Please try again.", "error");
      console.error("Login error:", error);
    }
  });

  logoutButton.addEventListener("click", () => {
    clearToken();
    setMessage("Logged out successfully.", "info");
  });

  fetchCurrentUser();
});
