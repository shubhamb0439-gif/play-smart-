import Experience from "@/components/Experience";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import Preloader from "@/components/Preloader";
import Reveal from "@/components/Reveal";
import { SmoothScrollProvider } from "@/components/SmoothScrollProvider";
import Enquiry from "@/sections/Enquiry";
import Membership from "@/sections/Membership";
import Programmes from "@/sections/Programmes";

export default function Home() {
  return (
    <SmoothScrollProvider>
      <Preloader />
      <Header />
      <main id="main">
        <Experience />
        <Reveal className="relative z-10 bg-ink">
          <Programmes />
          <Membership />
          <Enquiry />
        </Reveal>
      </main>
      <Footer />
    </SmoothScrollProvider>
  );
}
