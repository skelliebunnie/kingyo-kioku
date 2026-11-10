import "../styles/SiteFooter.css";

function getYear() {
	return new Date().getFullYear();
}

const SiteFooter = () => {
	const year = getYear();
	
	return (
		<footer className="site-footer">
		<p>SkellieBunnie &copy; {year}</p>
		</footer>
	)
}

export default SiteFooter;