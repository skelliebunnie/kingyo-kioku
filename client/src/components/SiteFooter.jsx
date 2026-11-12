import OptionsMenu from "../components/OptionsMenu";
import "../styles/SiteFooter.css";

function getYear() {
	return new Date().getFullYear();
}

const SiteFooter = () => {
	const year = getYear();
	
	return (
		<footer className="site-footer">
				<p>SkellieBunnie &copy; {year}</p>
				<OptionsMenu />
		</footer>
	)
}

export default SiteFooter;