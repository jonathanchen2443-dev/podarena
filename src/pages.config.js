/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Approvals from './pages/Approvals';
import Badges from './pages/Badges';
import CreateLeague from './pages/CreateLeague';
import Dashboard from './pages/Dashboard';
import Decks from './pages/Decks';
import Founder from './pages/Founder';
import Home from './pages/Home';
import Inbox from './pages/Inbox';
import Invite from './pages/Invite';
import LeagueDetails from './pages/LeagueDetails';
import Leagues from './pages/Leagues';
import LeaguesList from './pages/LeaguesList';
import Pods from './pages/Pods';
import Profile from './pages/Profile';
import ProfileDecks from './pages/ProfileDecks';
import Register from './pages/Register';
import UserProfile from './pages/UserProfile';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Approvals": Approvals,
    "Badges": Badges,
    "CreateLeague": CreateLeague,
    "Dashboard": Dashboard,
    "Decks": Decks,
    "Founder": Founder,
    "Home": Home,
    "Inbox": Inbox,
    "Invite": Invite,
    "LeagueDetails": LeagueDetails,
    "Leagues": Leagues,
    "LeaguesList": LeaguesList,
    "Pods": Pods,
    "Profile": Profile,
    "ProfileDecks": ProfileDecks,
    "Register": Register,
    "UserProfile": UserProfile,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};