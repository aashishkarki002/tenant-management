import axios from "axios";

const axiosInstance = axios.create({
    baseURL: "http://localhost:3000",
    headers: {
        "Content-Type": "application/json",
    },
    withCredentials: true, // Include cookies for refresh token
});

// Request interceptor - adds bearer token to all requests
axiosInstance.interceptors.request.use(
    async (config) => {
        // Get token from localStorage
        const token = localStorage.getItem("token");
        
        // If token exists, add it to Authorization header as Bearer token
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        
        return config;
    },
    (error) => {
        // Handle request error
        return Promise.reject(error);
    }
);

// Response interceptor - handles authentication errors
axiosInstance.interceptors.response.use(
    (response) => {
        // If response is successful, return it as is
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        // Handle 401 Unauthorized errors
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                // Attempt to refresh the token
                const refreshResponse = await axios.post(
                    `${axiosInstance.defaults.baseURL}/api/auth/refresh-token`,
                    {},
                    { withCredentials: true }
                );

                if (refreshResponse.data.success && refreshResponse.data.token) {
                    // Store the new access token
                    localStorage.setItem("token", refreshResponse.data.token);
                    
                    // Update the original request with new token
                    originalRequest.headers.Authorization = `Bearer ${refreshResponse.data.token}`;
                    
                    // Retry the original request
                    return axiosInstance(originalRequest);
                }
            } catch (refreshError) {
                // Refresh token failed - clear storage and redirect to login
                localStorage.removeItem("token");
                
                // Redirect to login page if not already there
                if (window.location.pathname !== "/login") {
                    window.location.href = "/login";
                }
                
                return Promise.reject(refreshError);
            }
        }

        // For other errors, just reject the promise
        return Promise.reject(error);
    }
);

export default axiosInstance;