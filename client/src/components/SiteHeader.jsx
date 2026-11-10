import { Link } from "react-router";
import { useAuth } from "../context/AuthContext";

import OptionsMenu from "./OptionsMenu";

import { LogOut, UserIcon, NotebookText } from 'lucide-react';

import "../styles/SiteHeader.css";

const Navbar = () => {
	const { user, logout } = useAuth();
	
  return (
    <header className="site-header">
      <h1 className="site-title"><img src="assets/goldfish.png" width="100" /> 金魚記憶</h1>
      <div className="nav-set">
      <OptionsMenu />
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
        <Link to="/login">Log in</Link>
      )}
      </div>
    </header>
  )
};

export default Navbar;
