import { Link } from "react-router";
import { useAuth } from "../context/AuthContext";

import { LogOut, UserIcon, NotebookText, LogIn } from 'lucide-react';

import "../styles/SiteHeader.css";

const Navbar = () => {
	const { user, logout } = useAuth();
	
  return (
    <header className="site-header">
      <h1 className="site-title"><Link to="/"><span>金魚</span><img src="assets/goldfish.png" width="100" /><span>記憶</span></Link></h1>
      <div className="nav-set">
      {user ? (
        <nav className="site-nav">
          <ul className="menu">
            <li><Link to="/study"><NotebookText />Study</Link></li>
          </ul>
          <div className="user">
            <Link to="/profile"><UserIcon /> {user.username}</Link>
            <button onClick={logout}><LogOut /> <span>Log out</span></button> 
          </div>
          
        </nav>
      ) : (
        <Link to="/login"><LogIn /> Log in</Link>
      )}
      </div>
    </header>
  )
};

export default Navbar;
