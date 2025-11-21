# -------------------------
# 1. Base Image
# -------------------------
    FROM node:18-alpine

    # -------------------------
    # 2. Set Working Directory
    # -------------------------
    WORKDIR /app
    
    # -------------------------
    # 3. Copy Package Files First (Better caching)
    # -------------------------
    COPY package.json package-lock.json* ./
    
    # -------------------------
    # 4. Install Only Production Dependencies
    # -------------------------
    RUN npm install --production
    
    # -------------------------
    # 5. Copy the Rest of Your Project
    # -------------------------
    COPY . .
    
    # -------------------------
    # 6. Expose Port (Render injects PORT env automatically)
    # -------------------------
    EXPOSE 8080
    
    # -------------------------
    # 7. Start the Server
    # -------------------------
    CMD ["npm", "start"]
    