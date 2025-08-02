# Taskeen - AI-Powered Mental Health Tracker 🧠💚

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-13.0+-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18.0+-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)
[![Hugging Face](https://img.shields.io/badge/🤗-Hugging%20Face-yellow)](https://huggingface.co/)

## 📖 Overview

Taskeen (تسکین - meaning "comfort" in Urdu) is a comprehensive mental health tracking application that combines mood logging, AI-powered insights using Hugging Face models, and wellness goal management. Built with Next.js and TypeScript, it provides users with a beautiful, intuitive interface to monitor their mental health journey while receiving personalized recommendations powered by state-of-the-art AI models.

### ✨ Key Features

- **🎯 Mood Tracking**: Log daily moods with detailed descriptions and categorization
- **🤖 AI-Powered Insights**: Get personalized recommendations using Hugging Face AI models
- **📊 Analytics Dashboard**: Visualize mood patterns with interactive charts and statistics
- **📅 Calendar View**: Track mood history with an intuitive calendar interface
- **🎯 Wellness Goals**: Set and track daily, weekly, and monthly mental health goals
- **👤 User Profiles**: Comprehensive user management with preferences and statistics
- **🔒 Secure Authentication**: Magic link authentication via Supabase
- **💻 Responsive Design**: Beautiful UI that works on all devices
- **🌍 Culturally Sensitive**: Designed with mental health awareness for diverse communities

## 🏗️ Tech Stack

### Frontend
- **Next.js 13+** - React framework with App Router
- **React 18** - UI library with hooks
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **Canvas API** - Custom chart rendering

### Backend & Database
- **MongoDB** - NoSQL database for data storage
- **Supabase** - Authentication and real-time features
- **Hugging Face API** - AI models for sentiment analysis and recommendations

### Key Libraries
- **Supabase Client** - Authentication and database operations
- **React Hooks** - State management and side effects
- **Hugging Face Inference API** - AI-powered insights

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (v18.0 or higher)
- **npm** or **yarn** package manager
- **MongoDB** database (local or cloud)
- **Supabase** account and project
- **Hugging Face** account and API token

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/anaksha17/grand-project
   cd taskeen
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory:
   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

   # MongoDB Configuration
   MONGODB_URI=your_mongodb_connection_string

   # Hugging Face Configuration
   HUGGING_FACE_API_TOKEN=your_hugging_face_api_token
   HUGGING_FACE_MODEL=microsoft/DialoGPT-medium
   # Alternative models you can use:
   # HUGGING_FACE_MODEL=facebook/blenderbot-400M-distill
   # HUGGING_FACE_MODEL=cardiffnlp/twitter-roberta-base-sentiment-latest

   # Application Configuration
   NEXTAUTH_SECRET=your_nextauth_secret
   NEXTAUTH_URL=http://localhost:3000
   ```

4. **Set up Supabase**
   - Create a new Supabase project
   - Configure authentication providers
   - Set up email templates for magic links

5. **Set up MongoDB**
   - Create a MongoDB database
   - Set up collections for users, moods, and wellness goals

6. **Set up Hugging Face API**
   - Create a Hugging Face account at [huggingface.co](https://huggingface.co)
   - Generate an API token from your profile settings
   - Choose your preferred models for sentiment analysis and text generation

7. **Run the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

8. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000) to see Taskeen in action.

## 📱 Application Structure

### Main Components

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── moods/         # Mood tracking endpoints
│   │   ├── users/         # User management endpoints
│   │   ├── wellness-goals/# Goals management endpoints
│   │   └── huggingface/   # AI recommendations endpoints
│   ├── login/             # Authentication pages
│   └── page.tsx           # Main application page
├── components/            # Reusable React components
├── utils/                 # Utility functions
│   ├── supabase/         # Supabase configuration
│   └── huggingface/      # Hugging Face API utilities
└── types/                 # TypeScript type definitions
```

### Key Features Implementation

#### 🎯 Mood Tracking
- **Smart Suggestions**: AI-powered mood text suggestions using Hugging Face models
- **Sentiment Analysis**: Automatic mood classification using transformer models
- **Categorization**: Happy, Sad, Stressed, Anxious, Calm mood states
- **Timestamp Tracking**: Automatic date/time logging
- **Real-time Updates**: Instant data synchronization

#### 📊 Analytics & Insights
- **Pie Charts**: Visual mood distribution using Canvas API
- **Statistics Cards**: Current streak, total entries, weekly progress
- **Trend Analysis**: Historical mood pattern recognition using AI
- **Performance Metrics**: Detailed breakdown tables

#### 📅 Calendar Integration
- **Visual Timeline**: Color-coded mood calendar
- **Monthly Navigation**: Browse historical data
- **Daily Details**: Click to view specific day's entries
- **Streak Tracking**: Visual representation of consistency

#### 🤖 AI-Powered Recommendations (Hugging Face)
- **Sentiment Analysis**: Automatic mood detection from text
- **Personalized Insights**: Tailored advice based on mood patterns
- **Immediate Actions**: Quick stress relief suggestions
- **Daily Practices**: Long-term wellness recommendations
- **Professional Insights**: Mental health guidance using trained models

## 🔧 API Endpoints

### Mood Management
```typescript
POST /api/moods              # Create new mood entry
GET  /api/moods/raw         # Get raw mood data
PUT  /api/moods             # Update mood entry
DELETE /api/moods           # Delete mood entry
```

### User Management
```typescript
GET  /api/users             # Get user profile
POST /api/users             # Create new user
PUT  /api/users             # Update user profile
GET  /api/user-stats        # Get user statistics
```

### Wellness Goals
```typescript
GET  /api/wellness-goals    # Get user goals
POST /api/wellness-goals    # Create new goal
PUT  /api/wellness-goals    # Update goal progress
DELETE /api/wellness-goals  # Delete goal
```

### AI Recommendations (Hugging Face)
```typescript
 
POST /api/ollama/recommendations # Get AI insights and Ollama is just for name sake (Hugging Faxe models are used)
POST /aoi/autocomplete/suggestions # Get AI suggestions for user Input log
```

## 🎨 UI/UX Features

### Design System
- **Glassmorphism**: Modern frosted glass effects
- **Gradient Backgrounds**: Calming color schemes inspired by nature
- **Smooth Animations**: Engaging micro-interactions
- **Responsive Layout**: Mobile-first design approach
- **Cultural Sensitivity**: Design elements that respect diverse backgrounds

### Accessibility
- **Semantic HTML**: Proper markup for screen readers
- **Keyboard Navigation**: Full keyboard accessibility
- **Color Contrast**: WCAG compliant color schemes
- **Focus Management**: Clear focus indicators
- **Multi-language Support**: RTL and LTR text support

## 📈 Data Models

### Mood Entry
```typescript
interface MoodEntry {
  _id?: string;
  moodText: string;
  moodState: "Happy" | "Sad" | "Stressed" ;
  userId: string;
  timestamp: Date;
  sentiment?: {
    score: number;
    label: string;
    confidence: number;
  };
  aiSuggestions?: string[];
}
```

### User Profile
```typescript
interface UserProfile {
  _id?: string;
  email: string;
  userId: string;
  profile: {
    firstName?: string;
    lastName?: string;
    age?: string;
    phoneNumber?: string;
    bio?: string;
    location?: {
      city?: string;
      country?: string;
    };
    language?: 'en' | 'ur' | 'hi';
  };
  preferences: {
    notifications: boolean;
    reminderTime?: string;
    theme?: 'light' | 'dark' | 'auto';
    aiRecommendations?: boolean;
  };
}
```

### Wellness Goal
```typescript
interface WellnessGoal {
  _id?: string;
  userId: string;
  title: string;
  description?: string;
  category: 'daily' | 'weekly' | 'monthly';
  targetValue?: number;
  currentProgress?: number;
  isCompleted: boolean;
  dueDate?: Date;
  aiGenerated?: boolean;
}
```

## 🤖 Hugging Face Integration

### Supported Models
- **Sentiment Analysis**: `j-hartmann/emotion-english-distilroberta-base`
- **Auto Complete**: `gemini-1.5-flash`
- **Emotion Detection**: `j-hartmann/emotion-english-distilroberta-base`

### AI Features
```typescript
// Sentiment Analysis
const analyzeSentiment = async (text: string) => {
  const response = await fetch(`${HUGGING_FACE_API_URL}/models/cardiffnlp/twitter-roberta-base-sentiment-latest`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HUGGING_FACE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inputs: text }),
  });
  return response.json();
};

// Generate Recommendations
const generateRecommendations = async (moodHistory: string[]) => {
  // Implementation using Hugging Face models
};
```

## 🔒 Security & Privacy

### Data Protection
- **Encryption**: All sensitive data encrypted at rest and in transit
- **Authentication**: Secure magic link authentication
- **Authorization**: User-specific data access controls
- **Privacy**: No data sharing with third parties
- **GDPR Compliance**: Full data protection compliance

### Best Practices
- **Input Validation**: All user inputs sanitized
- **Rate Limiting**: API endpoints protected against abuse
- **Error Handling**: Graceful error management
- **Logging**: Comprehensive audit trails
- **AI Ethics**: Responsible AI usage with bias monitoring

## 🚀 Deployment

### Vercel (Recommended)
1. **Connect your repository** to Vercel
2. **Configure environment variables** in Vercel dashboard
3. **Deploy** with automatic CI/CD

### Railway
```bash
# Deploy to Railway
railway login
railway init
railway add
railway deploy
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 🤝 Contributing

We welcome contributions to Taskeen! Here's how you can help:

### Development Process
1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Areas for Contribution
- 🐛 Bug fixes and improvements
- ✨ New AI features and models
- 📚 Documentation improvements
- 🎨 UI/UX enhancements
- 🌍 Internationalization support
- 🧪 Test coverage expansion

## 📊 Performance & Monitoring

### Key Metrics
- **Page Load Time**: < 3 seconds
- **First Contentful Paint**: < 1.5 seconds
- **Accessibility Score**: 95+
- **SEO Score**: 90+
- **AI Response Time**: < 2 seconds

## 🛠️ Troubleshooting

### Common Issues

#### Hugging Face API Issues
```bash
# Check API token validity
# Verify model availability
# Monitor rate limits
# Check network connectivity
```

#### Authentication Problems
```bash
# Clear browser cache and cookies
# Check Supabase configuration
# Verify email delivery settings
```

#### Database Connection Issues
```bash
# Verify MongoDB connection string
# Check network connectivity
# Validate database permissions
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Hugging Face** - For providing excellent AI models and APIs
- **Supabase** - For seamless authentication and real-time features
- **Next.js Team** - For the amazing React framework
- **MongoDB** - For reliable data storage
- **Tailwind CSS** - For beautiful, utility-first styling
- **Mental Health Community** - For inspiration and guidance

## 📞 Support

Need help? Here's how to get support:

- 📧 **Email**: anakshajanki@gmail.com


## 🗺️ Roadmap

### Version 2.0 (Coming Soon)
- 📱 Mobile app (React Native)
- 🔔 Push notifications
- 📈 Advanced AI analytics
- 🤝 Support groups (optional)
- 🌍 Multi-language support (Urdu, Hindi, Arabic)

### Version 2.5
- 🎵 Mood-based music recommendations
- 🧘 Guided meditation integration
- 📊 Therapist dashboard
- 🔗 Wearable device integration
- 🎯 Crisis intervention features

---

**Made with ❤️ for mental health awareness and support**

*تسکین - Bringing comfort through technology*

*Remember: Taskeen is a tool to support your mental health journey, but it's not a replacement for professional medical advice. If you're experiencing severe mental health issues, please consult with a qualified healthcare provider.*